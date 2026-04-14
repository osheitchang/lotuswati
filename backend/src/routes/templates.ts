import { Router, Request, Response } from 'express';
import { z } from 'zod';
import prisma from '../lib/prisma';
import { authenticate } from '../middleware/auth';

const router = Router();
router.use(authenticate);

const templateSchema = z.object({
  name: z.string().min(1).regex(/^[a-z0-9_]+$/, 'Template name must be lowercase alphanumeric with underscores'),
  category: z.enum(['MARKETING', 'UTILITY', 'AUTHENTICATION']),
  language: z.string().default('en'),
  headerType: z.enum(['TEXT', 'IMAGE', 'VIDEO', 'DOCUMENT']).optional().nullable(),
  headerValue: z.string().optional().nullable(),
  body: z.string().min(1),
  footer: z.string().optional().nullable(),
  buttons: z.array(
    z.object({
      type: z.enum(['QUICK_REPLY', 'URL', 'PHONE_NUMBER']),
      text: z.string(),
      url: z.string().url().optional(),
      phone_number: z.string().optional(),
    })
  ).optional().default([]),
});

// GET /api/templates
router.get('/', async (req: Request, res: Response) => {
  try {
    const { status, category } = req.query as Record<string, string>;
    const where: Record<string, unknown> = { teamId: req.user!.teamId };

    if (status) where.status = status;
    if (category) where.category = category;

    const templates = await prisma.template.findMany({
      where,
      orderBy: { createdAt: 'desc' },
    });

    return res.json({
      templates: templates.map((t) => ({
        ...t,
        buttons: (() => { try { return JSON.parse(t.buttons); } catch { return []; } })(),
      })),
    });
  } catch (err) {
    console.error('[Templates] List error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/templates
router.post('/', async (req: Request, res: Response) => {
  try {
    const parsed = templateSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: 'Validation failed', details: parsed.error.errors });
    }

    const { buttons, ...rest } = parsed.data;

    // Check for duplicate name in team
    const existing = await prisma.template.findFirst({
      where: { name: rest.name, teamId: req.user!.teamId },
    });

    if (existing) {
      return res.status(409).json({ error: 'A template with this name already exists' });
    }

    const template = await prisma.template.create({
      data: {
        ...rest,
        buttons: JSON.stringify(buttons || []),
        teamId: req.user!.teamId,
        status: 'pending',
      },
    });

    return res.status(201).json({
      template: {
        ...template,
        buttons: (() => { try { return JSON.parse(template.buttons); } catch { return []; } })(),
      },
    });
  } catch (err) {
    console.error('[Templates] Create error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/templates/:id
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const template = await prisma.template.findFirst({
      where: { id: req.params.id, teamId: req.user!.teamId },
    });

    if (!template) {
      return res.status(404).json({ error: 'Template not found' });
    }

    return res.json({
      template: {
        ...template,
        buttons: (() => { try { return JSON.parse(template.buttons); } catch { return []; } })(),
      },
    });
  } catch (err) {
    console.error('[Templates] Get error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// PATCH /api/templates/:id
router.patch('/:id', async (req: Request, res: Response) => {
  try {
    const template = await prisma.template.findFirst({
      where: { id: req.params.id, teamId: req.user!.teamId },
    });

    if (!template) {
      return res.status(404).json({ error: 'Template not found' });
    }

    if (template.status === 'approved') {
      return res.status(400).json({
        error: 'Approved templates cannot be edited. Create a new template instead.',
      });
    }

    const updateSchema = templateSchema.partial();
    const parsed = updateSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: 'Validation failed', details: parsed.error.errors });
    }

    const { buttons, ...rest } = parsed.data;
    const updateData: Record<string, unknown> = { ...rest };
    if (buttons !== undefined) updateData.buttons = JSON.stringify(buttons);

    const updated = await prisma.template.update({
      where: { id: req.params.id },
      data: { ...updateData, status: 'pending' }, // Reset to pending on edit
    });

    return res.json({
      template: {
        ...updated,
        buttons: (() => { try { return JSON.parse(updated.buttons); } catch { return []; } })(),
      },
    });
  } catch (err) {
    console.error('[Templates] Update error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// DELETE /api/templates/:id
router.delete('/:id', async (req: Request, res: Response) => {
  try {
    const template = await prisma.template.findFirst({
      where: { id: req.params.id, teamId: req.user!.teamId },
    });

    if (!template) {
      return res.status(404).json({ error: 'Template not found' });
    }

    await prisma.template.delete({ where: { id: req.params.id } });

    return res.json({ message: 'Template deleted successfully' });
  } catch (err) {
    console.error('[Templates] Delete error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/templates/sync — pull approved templates from Meta and upsert locally
router.post('/sync', async (req: Request, res: Response) => {
  try {
    const accessToken = process.env.WA_ACCESS_TOKEN;
    const wabaId = process.env.WA_BUSINESS_ACCOUNT_ID;

    if (!accessToken || !wabaId) {
      return res.status(503).json({
        error: 'WhatsApp credentials not configured. Set WA_ACCESS_TOKEN and WA_BUSINESS_ACCOUNT_ID.',
      });
    }

    const url = `https://graph.facebook.com/v21.0/${wabaId}/message_templates?limit=100&fields=name,status,category,language,components`;
    const metaRes = await fetch(url, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    if (!metaRes.ok) {
      const errBody = await metaRes.json().catch(() => ({}));
      console.error('[Templates] Meta API error:', errBody);
      return res.status(502).json({ error: 'Meta API request failed', details: errBody });
    }

    type MetaComponent = {
      type: string;
      format?: string;
      text?: string;
      buttons?: Array<{ type: string; text: string; url?: string; phone_number?: string }>;
    };
    type MetaTemplate = {
      name: string;
      status: string;
      category: string;
      language: string;
      components: MetaComponent[];
    };

    const payload = (await metaRes.json()) as { data: MetaTemplate[] };
    const metaTemplates = payload.data || [];

    let synced = 0;
    const teamId = req.user!.teamId;

    for (const t of metaTemplates) {
      const bodyComp = t.components.find((c) => c.type === 'BODY');
      if (!bodyComp?.text) continue; // skip templates with no body

      const headerComp = t.components.find((c) => c.type === 'HEADER');
      const footerComp = t.components.find((c) => c.type === 'FOOTER');
      const buttonsComp = t.components.find((c) => c.type === 'BUTTONS');

      const headerType = headerComp?.format ?? null;
      const headerValue = headerComp?.format === 'TEXT' ? (headerComp.text ?? null) : null;
      const footer = footerComp?.text ?? null;
      const buttons = (buttonsComp?.buttons ?? []).map((b) => ({
        type: b.type,
        text: b.text,
        ...(b.url ? { url: b.url } : {}),
        ...(b.phone_number ? { phone_number: b.phone_number } : {}),
      }));

      const statusMap: Record<string, string> = {
        APPROVED: 'approved',
        REJECTED: 'rejected',
        PENDING: 'pending',
        PAUSED: 'pending',
        DISABLED: 'rejected',
      };
      const status = statusMap[t.status.toUpperCase()] ?? 'pending';

      const validCategories = ['MARKETING', 'UTILITY', 'AUTHENTICATION'];
      const category = validCategories.includes(t.category.toUpperCase())
        ? t.category.toUpperCase()
        : 'UTILITY';

      const existing = await prisma.template.findFirst({
        where: { name: t.name, teamId },
      });

      if (existing) {
        await prisma.template.update({
          where: { id: existing.id },
          data: {
            status,
            category,
            language: t.language,
            body: bodyComp.text,
            headerType,
            headerValue,
            footer,
            buttons: JSON.stringify(buttons),
          },
        });
      } else {
        await prisma.template.create({
          data: {
            name: t.name,
            category,
            language: t.language,
            body: bodyComp.text,
            headerType,
            headerValue,
            footer,
            buttons: JSON.stringify(buttons),
            status,
            waTemplateId: t.name,
            teamId,
          },
        });
      }
      synced++;
    }

    console.log(`[Templates] Synced ${synced} templates for team ${teamId}`);
    return res.json({ message: `Synced ${synced} templates from Meta`, synced });
  } catch (err) {
    console.error('[Templates] Sync error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/templates/:id/submit
// Submit template to WhatsApp for approval (mock: instantly approves)
router.post('/:id/submit', async (req: Request, res: Response) => {
  try {
    const template = await prisma.template.findFirst({
      where: { id: req.params.id, teamId: req.user!.teamId },
    });

    if (!template) {
      return res.status(404).json({ error: 'Template not found' });
    }

    if (template.status === 'approved') {
      return res.status(400).json({ error: 'Template is already approved' });
    }

    const mockWaTemplateId = `wa_tmpl_${Date.now()}`;

    const updated = await prisma.template.update({
      where: { id: req.params.id },
      data: {
        status: 'approved',
        waTemplateId: mockWaTemplateId,
      },
    });

    console.log(`[Templates] Mock submission - Template "${template.name}" approved with WA ID: ${mockWaTemplateId}`);

    return res.json({
      template: {
        ...updated,
        buttons: (() => { try { return JSON.parse(updated.buttons); } catch { return []; } })(),
      },
      message: 'Template submitted and approved (mock mode)',
    });
  } catch (err) {
    console.error('[Templates] Submit error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
