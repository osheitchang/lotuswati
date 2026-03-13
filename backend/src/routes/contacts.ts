import { Router, Request, Response } from 'express';
import { z } from 'zod';
import prisma from '../lib/prisma';
import { authenticate } from '../middleware/auth';

const router = Router();

// All routes require authentication
router.use(authenticate);

const contactSchema = z.object({
  phone: z.string().min(7, 'Phone number must be at least 7 characters'),
  name: z.string().optional().nullable(),
  email: z.string().email().optional().nullable(),
  avatar: z.string().url().optional().nullable(),
  tags: z.array(z.string()).optional(),
  customFields: z.record(z.unknown()).optional(),
});

// GET /api/contacts
router.get('/', async (req: Request, res: Response) => {
  try {
    const {
      page = '1',
      limit = '20',
      search,
      tags,
      blocked,
    } = req.query as Record<string, string>;

    const pageNum = Math.max(1, parseInt(page));
    const limitNum = Math.min(100, Math.max(1, parseInt(limit)));
    const skip = (pageNum - 1) * limitNum;

    const where: Record<string, unknown> = { teamId: req.user!.teamId };

    if (search) {
      where.OR = [
        { name: { contains: search } },
        { phone: { contains: search } },
        { email: { contains: search } },
      ];
    }

    if (blocked !== undefined) {
      where.blocked = blocked === 'true';
    }

    const [contacts, total] = await Promise.all([
      prisma.contact.findMany({
        where,
        skip,
        take: limitNum,
        orderBy: { createdAt: 'desc' },
        include: {
          _count: {
            select: { conversations: true },
          },
        },
      }),
      prisma.contact.count({ where }),
    ]);

    // Filter by tags if provided (tags stored as JSON string)
    let filteredContacts = contacts;
    if (tags) {
      const tagList = tags.split(',').map((t) => t.trim());
      filteredContacts = contacts.filter((c) => {
        try {
          const contactTags = JSON.parse(c.tags) as string[];
          return tagList.some((tag) => contactTags.includes(tag));
        } catch {
          return false;
        }
      });
    }

    return res.json({
      contacts: filteredContacts.map((c) => ({
        ...c,
        tags: (() => { try { return JSON.parse(c.tags); } catch { return []; } })(),
        customFields: (() => { try { return JSON.parse(c.customFields); } catch { return {}; } })(),
      })),
      pagination: {
        total,
        page: pageNum,
        limit: limitNum,
        totalPages: Math.ceil(total / limitNum),
      },
    });
  } catch (err) {
    console.error('[Contacts] List error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/contacts
router.post('/', async (req: Request, res: Response) => {
  try {
    const parsed = contactSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: 'Validation failed', details: parsed.error.errors });
    }

    const { phone, name, email, avatar, tags = [], customFields = {} } = parsed.data;

    // Check for duplicate
    const existing = await prisma.contact.findUnique({
      where: { phone_teamId: { phone, teamId: req.user!.teamId } },
    });

    if (existing) {
      return res.status(409).json({ error: 'Contact with this phone number already exists' });
    }

    const contact = await prisma.contact.create({
      data: {
        phone,
        name,
        email,
        avatar,
        tags: JSON.stringify(tags),
        customFields: JSON.stringify(customFields),
        teamId: req.user!.teamId,
      },
    });

    return res.status(201).json({
      contact: {
        ...contact,
        tags,
        customFields,
      },
    });
  } catch (err) {
    console.error('[Contacts] Create error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/contacts/export
router.get('/export', async (req: Request, res: Response) => {
  try {
    const contacts = await prisma.contact.findMany({
      where: { teamId: req.user!.teamId },
      orderBy: { createdAt: 'desc' },
    });

    const exportData = contacts.map((c) => ({
      id: c.id,
      phone: c.phone,
      name: c.name,
      email: c.email,
      tags: (() => { try { return JSON.parse(c.tags); } catch { return []; } })(),
      customFields: (() => { try { return JSON.parse(c.customFields); } catch { return {}; } })(),
      blocked: c.blocked,
      createdAt: c.createdAt,
    }));

    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', 'attachment; filename="contacts-export.json"');
    return res.json(exportData);
  } catch (err) {
    console.error('[Contacts] Export error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/contacts/import
router.post('/import', async (req: Request, res: Response) => {
  try {
    const importSchema = z.array(
      z.object({
        phone: z.string().min(7),
        name: z.string().optional().nullable(),
        email: z.string().email().optional().nullable(),
        tags: z.array(z.string()).optional(),
        customFields: z.record(z.unknown()).optional(),
      })
    );

    const parsed = importSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: 'Validation failed', details: parsed.error.errors });
    }

    const contacts = parsed.data;
    const results = { created: 0, skipped: 0, errors: 0, errorDetails: [] as string[] };

    for (const contact of contacts) {
      try {
        const existing = await prisma.contact.findUnique({
          where: {
            phone_teamId: { phone: contact.phone, teamId: req.user!.teamId },
          },
        });

        if (existing) {
          results.skipped++;
          continue;
        }

        await prisma.contact.create({
          data: {
            phone: contact.phone,
            name: contact.name,
            email: contact.email,
            tags: JSON.stringify(contact.tags || []),
            customFields: JSON.stringify(contact.customFields || {}),
            teamId: req.user!.teamId,
          },
        });

        results.created++;
      } catch (err) {
        results.errors++;
        results.errorDetails.push(`Failed to import ${contact.phone}: ${String(err)}`);
      }
    }

    return res.json({
      message: `Import complete. Created: ${results.created}, Skipped: ${results.skipped}, Errors: ${results.errors}`,
      results,
    });
  } catch (err) {
    console.error('[Contacts] Import error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/contacts/:id
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const contact = await prisma.contact.findFirst({
      where: { id: req.params.id, teamId: req.user!.teamId },
      include: {
        conversations: {
          orderBy: { lastMessageAt: 'desc' },
          take: 10,
          include: {
            _count: { select: { messages: true } },
            assignedTo: {
              select: { id: true, name: true, email: true, avatar: true },
            },
          },
        },
      },
    });

    if (!contact) {
      return res.status(404).json({ error: 'Contact not found' });
    }

    return res.json({
      contact: {
        ...contact,
        tags: (() => { try { return JSON.parse(contact.tags); } catch { return []; } })(),
        customFields: (() => { try { return JSON.parse(contact.customFields); } catch { return {}; } })(),
      },
    });
  } catch (err) {
    console.error('[Contacts] Get error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// PATCH /api/contacts/:id
router.patch('/:id', async (req: Request, res: Response) => {
  try {
    const existing = await prisma.contact.findFirst({
      where: { id: req.params.id, teamId: req.user!.teamId },
    });

    if (!existing) {
      return res.status(404).json({ error: 'Contact not found' });
    }

    const updateSchema = z.object({
      phone: z.string().min(7).optional(),
      name: z.string().optional().nullable(),
      email: z.string().email().optional().nullable(),
      avatar: z.string().url().optional().nullable(),
      tags: z.array(z.string()).optional(),
      customFields: z.record(z.unknown()).optional(),
    });

    const parsed = updateSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: 'Validation failed', details: parsed.error.errors });
    }

    const { tags, customFields, ...rest } = parsed.data;
    const updateData: Record<string, unknown> = { ...rest };

    if (tags !== undefined) updateData.tags = JSON.stringify(tags);
    if (customFields !== undefined) updateData.customFields = JSON.stringify(customFields);

    const contact = await prisma.contact.update({
      where: { id: req.params.id },
      data: updateData,
    });

    return res.json({
      contact: {
        ...contact,
        tags: (() => { try { return JSON.parse(contact.tags); } catch { return []; } })(),
        customFields: (() => { try { return JSON.parse(contact.customFields); } catch { return {}; } })(),
      },
    });
  } catch (err) {
    console.error('[Contacts] Update error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// DELETE /api/contacts/:id
router.delete('/:id', async (req: Request, res: Response) => {
  try {
    const contact = await prisma.contact.findFirst({
      where: { id: req.params.id, teamId: req.user!.teamId },
    });

    if (!contact) {
      return res.status(404).json({ error: 'Contact not found' });
    }

    await prisma.contact.delete({ where: { id: req.params.id } });

    return res.json({ message: 'Contact deleted successfully' });
  } catch (err) {
    console.error('[Contacts] Delete error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/contacts/:id/block
router.post('/:id/block', async (req: Request, res: Response) => {
  try {
    const contact = await prisma.contact.findFirst({
      where: { id: req.params.id, teamId: req.user!.teamId },
    });

    if (!contact) {
      return res.status(404).json({ error: 'Contact not found' });
    }

    const updated = await prisma.contact.update({
      where: { id: req.params.id },
      data: { blocked: !contact.blocked },
    });

    return res.json({
      contact: {
        ...updated,
        tags: (() => { try { return JSON.parse(updated.tags); } catch { return []; } })(),
        customFields: (() => { try { return JSON.parse(updated.customFields); } catch { return {}; } })(),
      },
      message: updated.blocked ? 'Contact blocked' : 'Contact unblocked',
    });
  } catch (err) {
    console.error('[Contacts] Block error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
