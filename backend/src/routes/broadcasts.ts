import { Router, Request, Response } from 'express';
import { z } from 'zod';
import prisma from '../lib/prisma';
import { authenticate } from '../middleware/auth';
import { sendTextMessage, sendTemplateMessage } from '../services/whatsapp';
import { getIO } from '../lib/socket';

const router = Router();
router.use(authenticate);

// GET /api/broadcasts
router.get('/', async (req: Request, res: Response) => {
  try {
    const { status, page = '1', limit = '20' } = req.query as Record<string, string>;
    const pageNum = Math.max(1, parseInt(page));
    const limitNum = Math.min(100, Math.max(1, parseInt(limit)));
    const skip = (pageNum - 1) * limitNum;

    const where: Record<string, unknown> = { teamId: req.user!.teamId };
    if (status) where.status = status;

    const [broadcasts, total] = await Promise.all([
      prisma.broadcast.findMany({
        where,
        skip,
        take: limitNum,
        orderBy: { createdAt: 'desc' },
        include: {
          _count: { select: { contacts: true } },
        },
      }),
      prisma.broadcast.count({ where }),
    ]);

    return res.json({
      broadcasts,
      pagination: {
        total,
        page: pageNum,
        limit: limitNum,
        totalPages: Math.ceil(total / limitNum),
      },
    });
  } catch (err) {
    console.error('[Broadcasts] List error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/broadcasts
router.post('/', async (req: Request, res: Response) => {
  try {
    const schema = z.object({
      name: z.string().min(1),
      templateId: z.string().uuid().optional().nullable(),
      message: z.string().optional().nullable(),
      contactIds: z.array(z.string().uuid()).optional(),
      filter: z
        .object({
          tags: z.array(z.string()).optional(),
          all: z.boolean().optional(),
        })
        .optional(),
    }).refine(
      (data) => data.templateId || data.message,
      { message: 'Either templateId or message is required' }
    );

    const parsed = schema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: 'Validation failed', details: parsed.error.errors });
    }

    const { name, templateId, message, contactIds, filter } = parsed.data;

    // Validate template if provided
    if (templateId) {
      const template = await prisma.template.findFirst({
        where: { id: templateId, teamId: req.user!.teamId, status: 'approved' },
      });
      if (!template) {
        return res.status(404).json({ error: 'Approved template not found' });
      }
    }

    // Resolve contact list
    let resolvedContactIds: string[] = contactIds || [];

    if (!resolvedContactIds.length && filter) {
      let contactWhere: Record<string, unknown> = {
        teamId: req.user!.teamId,
        blocked: false,
      };

      const contacts = await prisma.contact.findMany({
        where: contactWhere,
        select: { id: true, tags: true },
      });

      if (filter.all) {
        resolvedContactIds = contacts.map((c) => c.id);
      } else if (filter.tags && filter.tags.length > 0) {
        resolvedContactIds = contacts
          .filter((c) => {
            try {
              const contactTags = JSON.parse(c.tags) as string[];
              return filter.tags!.some((tag) => contactTags.includes(tag));
            } catch {
              return false;
            }
          })
          .map((c) => c.id);
      }
    }

    if (resolvedContactIds.length === 0) {
      return res.status(400).json({ error: 'No contacts selected for broadcast' });
    }

    // Verify all contacts belong to this team
    const validContacts = await prisma.contact.findMany({
      where: {
        id: { in: resolvedContactIds },
        teamId: req.user!.teamId,
        blocked: false,
      },
      select: { id: true },
    });

    const validContactIds = validContacts.map((c) => c.id);

    const broadcast = await prisma.$transaction(async (tx) => {
      const bc = await tx.broadcast.create({
        data: {
          name,
          templateId,
          message,
          teamId: req.user!.teamId,
          totalCount: validContactIds.length,
          status: 'draft',
        },
      });

      await tx.broadcastContact.createMany({
        data: validContactIds.map((contactId) => ({
          broadcastId: bc.id,
          contactId,
          status: 'pending',
        })),
      });

      return bc;
    });

    return res.status(201).json({ broadcast });
  } catch (err) {
    console.error('[Broadcasts] Create error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/broadcasts/:id
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const broadcast = await prisma.broadcast.findFirst({
      where: { id: req.params.id, teamId: req.user!.teamId },
      include: {
        _count: { select: { contacts: true } },
      },
    });

    if (!broadcast) {
      return res.status(404).json({ error: 'Broadcast not found' });
    }

    return res.json({ broadcast });
  } catch (err) {
    console.error('[Broadcasts] Get error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/broadcasts/:id/contacts
router.get('/:id/contacts', async (req: Request, res: Response) => {
  try {
    const broadcast = await prisma.broadcast.findFirst({
      where: { id: req.params.id, teamId: req.user!.teamId },
    });

    if (!broadcast) {
      return res.status(404).json({ error: 'Broadcast not found' });
    }

    const { page = '1', limit = '50', status } = req.query as Record<string, string>;
    const pageNum = Math.max(1, parseInt(page));
    const limitNum = Math.min(100, Math.max(1, parseInt(limit)));
    const skip = (pageNum - 1) * limitNum;

    const where: Record<string, unknown> = { broadcastId: req.params.id };
    if (status) where.status = status;

    const [contacts, total] = await Promise.all([
      prisma.broadcastContact.findMany({
        where,
        skip,
        take: limitNum,
        include: {
          contact: {
            select: { id: true, name: true, phone: true, avatar: true },
          },
        },
        orderBy: { contact: { name: 'asc' } },
      }),
      prisma.broadcastContact.count({ where }),
    ]);

    return res.json({
      contacts,
      pagination: {
        total,
        page: pageNum,
        limit: limitNum,
        totalPages: Math.ceil(total / limitNum),
      },
    });
  } catch (err) {
    console.error('[Broadcasts] Get contacts error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/broadcasts/:id/send
router.post('/:id/send', async (req: Request, res: Response) => {
  try {
    const broadcast = await prisma.broadcast.findFirst({
      where: { id: req.params.id, teamId: req.user!.teamId },
    });

    if (!broadcast) {
      return res.status(404).json({ error: 'Broadcast not found' });
    }

    if (!['draft', 'scheduled'].includes(broadcast.status)) {
      return res.status(400).json({
        error: `Cannot send broadcast in "${broadcast.status}" status`,
      });
    }

    // Mark as running immediately
    await prisma.broadcast.update({
      where: { id: broadcast.id },
      data: { status: 'running', startedAt: new Date() },
    });

    // Return immediately, process async
    res.json({ message: 'Broadcast sending started', broadcastId: broadcast.id });

    // Async processing
    processBroadcast(broadcast.id, req.user!.teamId).catch(console.error);
  } catch (err) {
    console.error('[Broadcasts] Send error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/broadcasts/:id/schedule
router.post('/:id/schedule', async (req: Request, res: Response) => {
  try {
    const broadcast = await prisma.broadcast.findFirst({
      where: { id: req.params.id, teamId: req.user!.teamId },
    });

    if (!broadcast) {
      return res.status(404).json({ error: 'Broadcast not found' });
    }

    if (broadcast.status !== 'draft') {
      return res.status(400).json({ error: 'Only draft broadcasts can be scheduled' });
    }

    const schema = z.object({
      scheduledAt: z.string().datetime(),
    });

    const parsed = schema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: 'Validation failed', details: parsed.error.errors });
    }

    const scheduledAt = new Date(parsed.data.scheduledAt);
    if (scheduledAt <= new Date()) {
      return res.status(400).json({ error: 'Scheduled time must be in the future' });
    }

    const updated = await prisma.broadcast.update({
      where: { id: broadcast.id },
      data: { status: 'scheduled', scheduledAt },
    });

    return res.json({ broadcast: updated, message: 'Broadcast scheduled' });
  } catch (err) {
    console.error('[Broadcasts] Schedule error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// DELETE /api/broadcasts/:id
router.delete('/:id', async (req: Request, res: Response) => {
  try {
    const broadcast = await prisma.broadcast.findFirst({
      where: { id: req.params.id, teamId: req.user!.teamId },
    });

    if (!broadcast) {
      return res.status(404).json({ error: 'Broadcast not found' });
    }

    if (!['draft', 'scheduled'].includes(broadcast.status)) {
      return res.status(400).json({
        error: 'Only draft or scheduled broadcasts can be deleted',
      });
    }

    await prisma.broadcast.delete({ where: { id: broadcast.id } });

    return res.json({ message: 'Broadcast deleted' });
  } catch (err) {
    console.error('[Broadcasts] Delete error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * Async broadcast processing function
 * Sends messages to all contacts in the broadcast with rate limiting
 */
async function processBroadcast(broadcastId: string, teamId: string): Promise<void> {
  console.log(`[Broadcast] Starting processing for broadcast ${broadcastId}`);

  try {
    const broadcast = await prisma.broadcast.findUnique({
      where: { id: broadcastId },
    });

    if (!broadcast) return;

    // Get template if provided
    let template = null;
    if (broadcast.templateId) {
      template = await prisma.template.findUnique({
        where: { id: broadcast.templateId },
      });
    }

    // Get all pending contacts
    const pendingContacts = await prisma.broadcastContact.findMany({
      where: { broadcastId, status: 'pending' },
      include: {
        contact: { select: { id: true, phone: true, name: true } },
      },
    });

    let sentCount = broadcast.sentCount;
    let failedCount = broadcast.failedCount;

    for (const bc of pendingContacts) {
      try {
        let success = false;
        let waMessageId = '';

        if (template) {
          const result = await sendTemplateMessage(
            bc.contact.phone,
            template.name,
            template.language,
            [],
            teamId
          );
          success = result.success;
          waMessageId = result.messageId;
        } else if (broadcast.message) {
          const result = await sendTextMessage(bc.contact.phone, broadcast.message, teamId);
          success = result.success;
          waMessageId = result.messageId;
        }

        await prisma.broadcastContact.update({
          where: { id: bc.id },
          data: {
            status: success ? 'sent' : 'failed',
            sentAt: success ? new Date() : undefined,
            error: success ? undefined : 'Failed to send via WhatsApp API',
          },
        });

        if (success) {
          sentCount++;

          // Find or create conversation for this contact
          let conversation = await prisma.conversation.findFirst({
            where: { contactId: bc.contact.id, teamId, status: 'open' },
          });

          if (!conversation) {
            conversation = await prisma.conversation.create({
              data: {
                teamId,
                contactId: bc.contact.id,
                lastMessageAt: new Date(),
              },
            });
          }

          // Log the message
          await prisma.message.create({
            data: {
              conversationId: conversation.id,
              fromType: 'agent',
              type: template ? 'template' : 'text',
              content: broadcast.message || undefined,
              templateName: template?.name,
              status: 'sent',
              waMessageId: waMessageId || undefined,
              metadata: JSON.stringify({ broadcastId }),
            },
          });
        } else {
          failedCount++;
        }

        // Update progress counters
        await prisma.broadcast.update({
          where: { id: broadcastId },
          data: { sentCount, failedCount },
        });

        // Emit progress via socket
        try {
          const io = getIO();
          io.to(`team:${teamId}`).emit('broadcast:progress', {
            broadcastId,
            sentCount,
            failedCount,
            totalCount: broadcast.totalCount,
          });
        } catch { /* socket not initialized */ }

        // Rate limiting: 80 messages per second max (WhatsApp tier 1 limit)
        await new Promise((resolve) => setTimeout(resolve, 15));
      } catch (err) {
        console.error(`[Broadcast] Error sending to ${bc.contact.phone}:`, err);
        failedCount++;

        await prisma.broadcastContact.update({
          where: { id: bc.id },
          data: { status: 'failed', error: String(err) },
        });
      }
    }

    // Mark broadcast as completed
    await prisma.broadcast.update({
      where: { id: broadcastId },
      data: {
        status: 'completed',
        completedAt: new Date(),
        sentCount,
        failedCount,
      },
    });

    try {
      const io = getIO();
      io.to(`team:${teamId}`).emit('broadcast:completed', {
        broadcastId,
        sentCount,
        failedCount,
        totalCount: broadcast.totalCount,
      });
    } catch { /* socket not initialized */ }

    console.log(`[Broadcast] Completed broadcast ${broadcastId}. Sent: ${sentCount}, Failed: ${failedCount}`);
  } catch (err) {
    console.error(`[Broadcast] Fatal error for broadcast ${broadcastId}:`, err);

    await prisma.broadcast.update({
      where: { id: broadcastId },
      data: { status: 'failed' },
    });
  }
}

export default router;
