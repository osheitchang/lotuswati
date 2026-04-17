import { Router, Request, Response } from 'express';
import { z } from 'zod';
import prisma from '../lib/prisma';
import { authenticate, requireRole } from '../middleware/auth';
import { sendTextMessage, sendTemplateMessage, sendMediaMessage } from '../services/whatsapp';
import { processAutomations } from '../services/automation';
import { getIO } from '../lib/socket';

const router = Router();
router.use(authenticate);

/** Substitute {{1}}, {{2}}, … in a template body using ordered body parameters */
function renderTemplateBody(body: string, components: Array<{ type: string; parameters?: Array<{ type: string; text: string }> }>): string {
  const bodyComp = components.find((c) => c.type === 'body');
  if (!bodyComp?.parameters?.length) return body;
  let rendered = body;
  bodyComp.parameters.forEach((param, idx) => {
    rendered = rendered.replace(new RegExp(`\\{\\{${idx + 1}\\}\\}`, 'g'), param.text ?? '');
  });
  return rendered;
}

// GET /api/conversations
router.get('/', async (req: Request, res: Response) => {
  try {
    const {
      page = '1',
      limit = '20',
      status,
      assignedTo,
      label,
      search,
      unassigned,
    } = req.query as Record<string, string>;

    const pageNum = Math.max(1, parseInt(page));
    const limitNum = Math.min(100, Math.max(1, parseInt(limit)));
    const skip = (pageNum - 1) * limitNum;

    const where: Record<string, unknown> = { teamId: req.user!.teamId };

    if (status) where.status = status;
    if (assignedTo) where.assignedToId = assignedTo;
    if (unassigned === 'true') where.assignedToId = null;

    if (search) {
      where.OR = [
        { contact: { name: { contains: search } } },
        { contact: { phone: { contains: search } } },
      ];
    }

    if (label) {
      where.labels = {
        some: { labelId: label },
      };
    }

    const [conversations, total] = await Promise.all([
      prisma.conversation.findMany({
        where,
        skip,
        take: limitNum,
        orderBy: { lastMessageAt: 'desc' },
        include: {
          contact: {
            select: {
              id: true,
              name: true,
              phone: true,
              avatar: true,
              blocked: true,
            },
          },
          assignedTo: {
            select: { id: true, name: true, email: true, avatar: true },
          },
          labels: {
            include: {
              label: { select: { id: true, name: true, color: true } },
            },
          },
          messages: {
            orderBy: { createdAt: 'desc' },
            take: 1,
            select: {
              id: true,
              type: true,
              content: true,
              fromType: true,
              status: true,
              createdAt: true,
            },
          },
        },
      }),
      prisma.conversation.count({ where }),
    ]);

    return res.json({
      conversations: conversations.map((conv) => ({
        ...conv,
        labels: conv.labels.map((l) => l.label),
        lastMessage: conv.messages[0] || null,
        messages: undefined,
      })),
      pagination: {
        total,
        page: pageNum,
        limit: limitNum,
        totalPages: Math.ceil(total / limitNum),
      },
    });
  } catch (err) {
    console.error('[Conversations] List error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/conversations
router.post('/', async (req: Request, res: Response) => {
  try {
    const schema = z.object({
      contactId: z.string().uuid().optional(),
      phone: z.string().min(5).optional(),
      message: z.string().optional(),
      templateName: z.string().optional(),
      templateLanguage: z.string().default('en'),
      templateVariables: z.record(z.string()).optional(),
      assignedToId: z.string().uuid().optional().nullable(),
    }).refine((d) => d.contactId || d.phone, {
      message: 'Either contactId or phone is required',
    });

    const parsed = schema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: 'Validation failed', details: parsed.error.errors });
    }

    const { contactId, phone, message, templateName, templateLanguage, templateVariables, assignedToId } = parsed.data;
    const teamId = req.user!.teamId;

    // Resolve contact — look up by contactId or phone, creating if needed
    let contact;
    if (contactId) {
      contact = await prisma.contact.findFirst({
        where: { id: contactId, teamId },
      });
      if (!contact) {
        return res.status(404).json({ error: 'Contact not found' });
      }
    } else {
      const normalised = phone!.replace(/\D/g, '');
      contact = await prisma.contact.findUnique({
        where: { phone_teamId: { phone: normalised, teamId } },
      });
      if (!contact) {
        contact = await prisma.contact.create({
          data: { phone: normalised, name: normalised, teamId, tags: '[]', customFields: '{}' },
        });
      }
    }

    if (contact.blocked) {
      return res.status(403).json({ error: 'Cannot start conversation with blocked contact' });
    }

    // Return existing open conversation instead of creating a duplicate
    const existingOpen = await prisma.conversation.findFirst({
      where: { contactId: contact.id, teamId, status: 'open' },
      include: {
        contact: true,
        assignedTo: { select: { id: true, name: true, email: true, avatar: true } },
      },
    });
    if (existingOpen) {
      return res.status(200).json({ conversation: existingOpen });
    }

    // Reopen resolved/pending/snoozed conversation instead of creating a duplicate
    const existingClosed = await prisma.conversation.findFirst({
      where: { contactId: contact.id, teamId, status: { in: ['resolved', 'pending', 'snoozed'] } },
      orderBy: { lastMessageAt: 'desc' },
    });

    let conversation;
    if (existingClosed) {
      conversation = await prisma.conversation.update({
        where: { id: existingClosed.id },
        data: {
          status: 'open',
          lastMessageAt: new Date(),
          ...(assignedToId !== undefined ? { assignedToId } : {}),
        },
        include: {
          contact: true,
          assignedTo: { select: { id: true, name: true, email: true, avatar: true } },
        },
      });
    } else {
      conversation = await prisma.conversation.create({
        data: {
          teamId,
          contactId: contact.id,
          assignedToId: assignedToId || null,
          lastMessageAt: new Date(),
        },
        include: {
          contact: true,
          assignedTo: { select: { id: true, name: true, email: true, avatar: true } },
        },
      });
    }

    // Send initial message if provided
    if (templateName) {
      const bodyParams = Object.keys(templateVariables || {})
        .sort((a, b) => Number(a) - Number(b))
        .map((k) => ({ type: 'text' as const, text: (templateVariables || {})[k] }));
      const components = bodyParams.length > 0
        ? [{ type: 'body' as const, parameters: bodyParams }]
        : [];

      // Look up template body to render the content for display
      const templateRecord = await prisma.template.findFirst({
        where: { name: templateName, teamId },
      });
      const renderedContent = templateRecord
        ? renderTemplateBody(templateRecord.body, components)
        : undefined;

      const { messageId, success } = await sendTemplateMessage(
        contact.phone,
        templateName,
        templateLanguage,
        components,
        req.user!.teamId
      );

      await prisma.message.create({
        data: {
          conversationId: conversation.id,
          fromType: 'agent',
          fromId: req.user!.id,
          type: 'template',
          templateName,
          content: renderedContent,
          status: success ? 'sent' : 'failed',
          waMessageId: messageId || undefined,
        },
      });

      await prisma.conversation.update({
        where: { id: conversation.id },
        data: { lastMessageAt: new Date() },
      });
    } else if (message) {
      const { messageId, success } = await sendTextMessage(
        contact.phone,
        message,
        req.user!.teamId
      );

      await prisma.message.create({
        data: {
          conversationId: conversation.id,
          fromType: 'agent',
          fromId: req.user!.id,
          type: 'text',
          content: message,
          status: success ? 'sent' : 'failed',
          waMessageId: messageId || undefined,
        },
      });
    }

    // Emit socket event
    try {
      const io = getIO();
      io.to(`team:${req.user!.teamId}`).emit('conversation:created', { conversation });
    } catch { /* socket not initialized */ }

    // Process new_conversation automations
    processAutomations({
      type: 'new_conversation',
      conversationId: conversation.id,
      teamId: req.user!.teamId,
    }).catch(console.error);

    return res.status(201).json({ conversation });
  } catch (err) {
    console.error('[Conversations] Create error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/conversations/:id
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const conversation = await prisma.conversation.findFirst({
      where: { id: req.params.id, teamId: req.user!.teamId },
      include: {
        contact: true,
        assignedTo: {
          select: { id: true, name: true, email: true, avatar: true, status: true },
        },
        labels: {
          include: { label: true },
        },
        _count: {
          select: { messages: true, notes: true },
        },
      },
    });

    if (!conversation) {
      return res.status(404).json({ error: 'Conversation not found' });
    }

    // Reset unread count when viewing conversation
    await prisma.conversation.update({
      where: { id: req.params.id },
      data: { unreadCount: 0 },
    });

    return res.json({
      conversation: {
        ...conversation,
        contact: {
          ...conversation.contact,
          tags: (() => { try { return JSON.parse(conversation.contact.tags); } catch { return []; } })(),
          customFields: (() => { try { return JSON.parse(conversation.contact.customFields); } catch { return {}; } })(),
        },
        labels: conversation.labels.map((l) => l.label),
      },
    });
  } catch (err) {
    console.error('[Conversations] Get error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// PATCH /api/conversations/:id
router.patch('/:id', async (req: Request, res: Response) => {
  try {
    const conversation = await prisma.conversation.findFirst({
      where: { id: req.params.id, teamId: req.user!.teamId },
    });

    if (!conversation) {
      return res.status(404).json({ error: 'Conversation not found' });
    }

    const schema = z.object({
      status: z.enum(['open', 'resolved', 'pending', 'snoozed']).optional(),
      assignedToId: z.string().uuid().nullable().optional(),
    });

    const parsed = schema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: 'Validation failed', details: parsed.error.errors });
    }

    const updated = await prisma.conversation.update({
      where: { id: req.params.id },
      data: parsed.data,
      include: {
        contact: { select: { id: true, name: true, phone: true, avatar: true } },
        assignedTo: { select: { id: true, name: true, email: true, avatar: true } },
        labels: { include: { label: true } },
      },
    });

    try {
      const io = getIO();
      io.to(`team:${req.user!.teamId}`).emit('conversation:updated', { conversation: updated });
    } catch { /* socket not initialized */ }

    return res.json({ conversation: { ...updated, labels: updated.labels.map((l) => l.label) } });
  } catch (err) {
    console.error('[Conversations] Update error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// DELETE /api/conversations/:id — admin only, resolved conversations only
router.delete('/:id', requireRole('admin'), async (req: Request, res: Response) => {
  try {
    const conversation = await prisma.conversation.findFirst({
      where: { id: req.params.id, teamId: req.user!.teamId },
    });

    if (!conversation) {
      return res.status(404).json({ error: 'Conversation not found' });
    }

    if (conversation.status !== 'resolved') {
      return res.status(400).json({ error: 'Only resolved conversations can be deleted' });
    }

    await prisma.$transaction([
      prisma.conversationLabel.deleteMany({ where: { conversationId: req.params.id } }),
      prisma.note.deleteMany({ where: { conversationId: req.params.id } }),
      prisma.message.deleteMany({ where: { conversationId: req.params.id } }),
      prisma.conversation.delete({ where: { id: req.params.id } }),
    ]);

    try {
      const io = getIO();
      io.to(`team:${req.user!.teamId}`).emit('conversation:deleted', {
        conversationId: req.params.id,
      });
    } catch { /* socket not initialized */ }

    return res.json({ message: 'Conversation deleted' });
  } catch (err) {
    console.error('[Conversations] Delete error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/conversations/:id/messages
router.get('/:id/messages', async (req: Request, res: Response) => {
  try {
    const conversation = await prisma.conversation.findFirst({
      where: { id: req.params.id, teamId: req.user!.teamId },
    });

    if (!conversation) {
      return res.status(404).json({ error: 'Conversation not found' });
    }

    const { page = '1', limit = '50' } = req.query as Record<string, string>;
    const pageNum = Math.max(1, parseInt(page));
    const limitNum = Math.min(100, Math.max(1, parseInt(limit)));
    const skip = (pageNum - 1) * limitNum;

    const [messages, total] = await Promise.all([
      prisma.message.findMany({
        where: { conversationId: req.params.id },
        skip,
        take: limitNum,
        orderBy: { createdAt: 'asc' },
        include: {
          agent: {
            select: { id: true, name: true, email: true, avatar: true },
          },
        },
      }),
      prisma.message.count({ where: { conversationId: req.params.id } }),
    ]);

    return res.json({
      messages: messages.map((m) => ({
        ...m,
        metadata: (() => { try { return JSON.parse(m.metadata); } catch { return {}; } })(),
      })),
      pagination: {
        total,
        page: pageNum,
        limit: limitNum,
        totalPages: Math.ceil(total / limitNum),
      },
    });
  } catch (err) {
    console.error('[Conversations] Get messages error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/conversations/:id/messages
router.post('/:id/messages', async (req: Request, res: Response) => {
  try {
    const conversation = await prisma.conversation.findFirst({
      where: { id: req.params.id, teamId: req.user!.teamId },
      include: { contact: true },
    });

    if (!conversation) {
      return res.status(404).json({ error: 'Conversation not found' });
    }

    if (conversation.contact.blocked) {
      return res.status(403).json({ error: 'Cannot send message to blocked contact' });
    }

    const schema = z.discriminatedUnion('type', [
      z.object({
        type: z.literal('text'),
        content: z.string().min(1),
      }),
      z.object({
        type: z.literal('template'),
        templateName: z.string(),
        language: z.string().default('en'),
        components: z.array(z.unknown()).default([]),
      }),
      z.object({
        type: z.enum(['image', 'audio', 'video', 'file']),
        mediaUrl: z.string().url(),
        mediaName: z.string().optional(),
        mediaMimeType: z.string().optional(),
        content: z.string().optional(), // caption
      }),
    ]);

    const parsed = schema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: 'Validation failed', details: parsed.error.errors });
    }

    const data = parsed.data;
    let waMessageId: string | undefined;
    let sendSuccess = true;

    if (data.type === 'text') {
      const result = await sendTextMessage(
        conversation.contact.phone,
        data.content,
        req.user!.teamId
      );
      waMessageId = result.messageId || undefined;
      sendSuccess = result.success;
    } else if (data.type === 'template') {
      const result = await sendTemplateMessage(
        conversation.contact.phone,
        data.templateName,
        data.language,
        data.components as Array<{ type: 'header' | 'body' | 'button' }>,
        req.user!.teamId
      );
      waMessageId = result.messageId || undefined;
      sendSuccess = result.success;
    } else {
      const mediaType = data.type as 'image' | 'audio' | 'video' | 'document' | 'sticker';
      const resolvedMediaType: 'image' | 'audio' | 'video' | 'document' | 'sticker' =
        mediaType === ('file' as string) ? 'document' : mediaType;
      const result = await sendMediaMessage(
        conversation.contact.phone,
        resolvedMediaType,
        data.mediaUrl,
        data.content,
        req.user!.teamId,
        data.mediaName
      );
      waMessageId = result.messageId || undefined;
      sendSuccess = result.success;
    }

    const messageData: Record<string, unknown> = {
      conversationId: req.params.id,
      fromType: 'agent',
      fromId: req.user!.id,
      type: data.type,
      status: sendSuccess ? 'sent' : 'failed',
      waMessageId,
    };

    if (data.type === 'text') {
      messageData.content = data.content;
    } else if (data.type === 'template') {
      messageData.templateName = data.templateName;
      // Look up template body and render content for display
      const templateRecord = await prisma.template.findFirst({
        where: { name: data.templateName, teamId: req.user!.teamId },
      });
      if (templateRecord) {
        messageData.content = renderTemplateBody(
          templateRecord.body,
          (data.components ?? []) as Array<{ type: string; parameters?: Array<{ type: string; text: string }> }>
        );
      }
    } else {
      messageData.mediaUrl = data.mediaUrl;
      messageData.mediaName = data.mediaName;
      messageData.mediaMimeType = data.mediaMimeType;
      messageData.content = data.content;
    }

    const message = await prisma.message.create({
      data: messageData as Parameters<typeof prisma.message.create>[0]['data'],
      include: {
        agent: { select: { id: true, name: true, email: true, avatar: true } },
      },
    });

    // Update conversation
    await prisma.conversation.update({
      where: { id: req.params.id },
      data: {
        lastMessageAt: new Date(),
        status: 'open',
      },
    });

    // Emit socket events
    try {
      const io = getIO();
      io.to(`conversation:${req.params.id}`).emit('message:new', { message });
      io.to(`team:${req.user!.teamId}`).emit('conversation:message', {
        conversationId: req.params.id,
        message,
      });
    } catch { /* socket not initialized */ }

    return res.status(201).json({
      message: {
        ...message,
        metadata: (() => { try { return JSON.parse(message.metadata); } catch { return {}; } })(),
      },
    });
  } catch (err) {
    console.error('[Conversations] Send message error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/conversations/:id/notes
router.get('/:id/notes', async (req: Request, res: Response) => {
  try {
    const conversation = await prisma.conversation.findFirst({
      where: { id: req.params.id, teamId: req.user!.teamId },
    });

    if (!conversation) {
      return res.status(404).json({ error: 'Conversation not found' });
    }

    const notes = await prisma.note.findMany({
      where: { conversationId: req.params.id },
      include: {
        user: { select: { id: true, name: true, email: true, avatar: true } },
      },
      orderBy: { createdAt: 'asc' },
    });

    return res.json({ notes });
  } catch (err) {
    console.error('[Conversations] Get notes error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/conversations/:id/notes
router.post('/:id/notes', async (req: Request, res: Response) => {
  try {
    const conversation = await prisma.conversation.findFirst({
      where: { id: req.params.id, teamId: req.user!.teamId },
    });

    if (!conversation) {
      return res.status(404).json({ error: 'Conversation not found' });
    }

    const schema = z.object({ content: z.string().min(1) });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: 'Validation failed', details: parsed.error.errors });
    }

    const note = await prisma.note.create({
      data: {
        conversationId: req.params.id,
        userId: req.user!.id,
        content: parsed.data.content,
      },
      include: {
        user: { select: { id: true, name: true, email: true, avatar: true } },
      },
    });

    try {
      const io = getIO();
      io.to(`conversation:${req.params.id}`).emit('note:new', { note });
    } catch { /* socket not initialized */ }

    return res.status(201).json({ note });
  } catch (err) {
    console.error('[Conversations] Add note error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/conversations/:id/labels
router.post('/:id/labels', async (req: Request, res: Response) => {
  try {
    const conversation = await prisma.conversation.findFirst({
      where: { id: req.params.id, teamId: req.user!.teamId },
    });

    if (!conversation) {
      return res.status(404).json({ error: 'Conversation not found' });
    }

    const schema = z.object({ labelId: z.string().uuid() });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: 'Validation failed', details: parsed.error.errors });
    }

    const label = await prisma.label.findFirst({
      where: { id: parsed.data.labelId, teamId: req.user!.teamId },
    });

    if (!label) {
      return res.status(404).json({ error: 'Label not found' });
    }

    await prisma.conversationLabel.upsert({
      where: {
        conversationId_labelId: {
          conversationId: req.params.id,
          labelId: parsed.data.labelId,
        },
      },
      create: {
        conversationId: req.params.id,
        labelId: parsed.data.labelId,
      },
      update: {},
    });

    // Process label_added automations
    processAutomations({
      type: 'label_added',
      value: parsed.data.labelId,
      conversationId: req.params.id,
      teamId: req.user!.teamId,
    }).catch(console.error);

    return res.json({ message: 'Label added to conversation', label });
  } catch (err) {
    console.error('[Conversations] Add label error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// DELETE /api/conversations/:id/labels/:labelId
router.delete('/:id/labels/:labelId', async (req: Request, res: Response) => {
  try {
    const conversation = await prisma.conversation.findFirst({
      where: { id: req.params.id, teamId: req.user!.teamId },
    });

    if (!conversation) {
      return res.status(404).json({ error: 'Conversation not found' });
    }

    await prisma.conversationLabel.deleteMany({
      where: {
        conversationId: req.params.id,
        labelId: req.params.labelId,
      },
    });

    return res.json({ message: 'Label removed from conversation' });
  } catch (err) {
    console.error('[Conversations] Remove label error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/conversations/:id/assign
router.post('/:id/assign', async (req: Request, res: Response) => {
  try {
    const conversation = await prisma.conversation.findFirst({
      where: { id: req.params.id, teamId: req.user!.teamId },
    });

    if (!conversation) {
      return res.status(404).json({ error: 'Conversation not found' });
    }

    const schema = z.object({
      agentId: z.string().uuid().nullable(),
    });

    const parsed = schema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: 'Validation failed', details: parsed.error.errors });
    }

    if (parsed.data.agentId) {
      const agent = await prisma.user.findFirst({
        where: { id: parsed.data.agentId, teamId: req.user!.teamId },
      });

      if (!agent) {
        return res.status(404).json({ error: 'Agent not found in this team' });
      }
    }

    const updated = await prisma.conversation.update({
      where: { id: req.params.id },
      data: { assignedToId: parsed.data.agentId },
      include: {
        assignedTo: { select: { id: true, name: true, email: true, avatar: true } },
      },
    });

    // Create system message
    const agentName = updated.assignedTo?.name || 'Unassigned';
    await prisma.message.create({
      data: {
        conversationId: req.params.id,
        fromType: 'system',
        type: 'text',
        content: parsed.data.agentId
          ? `Conversation assigned to ${agentName}`
          : 'Conversation unassigned',
        status: 'sent',
      },
    });

    try {
      const io = getIO();
      io.to(`team:${req.user!.teamId}`).emit('conversation:assigned', {
        conversationId: req.params.id,
        assignedTo: updated.assignedTo,
      });
    } catch { /* socket not initialized */ }

    return res.json({
      message: parsed.data.agentId ? `Assigned to ${agentName}` : 'Unassigned',
      assignedTo: updated.assignedTo,
    });
  } catch (err) {
    console.error('[Conversations] Assign error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/conversations/:id/resolve
router.post('/:id/resolve', async (req: Request, res: Response) => {
  try {
    const conversation = await prisma.conversation.findFirst({
      where: { id: req.params.id, teamId: req.user!.teamId },
    });

    if (!conversation) {
      return res.status(404).json({ error: 'Conversation not found' });
    }

    const updated = await prisma.conversation.update({
      where: { id: req.params.id },
      data: { status: 'resolved' },
    });

    await prisma.message.create({
      data: {
        conversationId: req.params.id,
        fromType: 'system',
        type: 'text',
        content: `Conversation resolved by ${req.user!.email}`,
        status: 'sent',
      },
    });

    try {
      const io = getIO();
      io.to(`team:${req.user!.teamId}`).emit('conversation:resolved', {
        conversationId: req.params.id,
      });
    } catch { /* socket not initialized */ }

    // Process conversation_resolved automations
    processAutomations({
      type: 'conversation_resolved',
      conversationId: req.params.id,
      teamId: req.user!.teamId,
    }).catch(console.error);

    return res.json({ conversation: updated, message: 'Conversation resolved' });
  } catch (err) {
    console.error('[Conversations] Resolve error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/conversations/:id/reopen
router.post('/:id/reopen', async (req: Request, res: Response) => {
  try {
    const conversation = await prisma.conversation.findFirst({
      where: { id: req.params.id, teamId: req.user!.teamId },
    });

    if (!conversation) {
      return res.status(404).json({ error: 'Conversation not found' });
    }

    const updated = await prisma.conversation.update({
      where: { id: req.params.id },
      data: { status: 'open' },
    });

    await prisma.message.create({
      data: {
        conversationId: req.params.id,
        fromType: 'system',
        type: 'text',
        content: `Conversation reopened by ${req.user!.email}`,
        status: 'sent',
      },
    });

    try {
      const io = getIO();
      io.to(`team:${req.user!.teamId}`).emit('conversation:reopened', {
        conversationId: req.params.id,
      });
    } catch { /* socket not initialized */ }

    return res.json({ conversation: updated, message: 'Conversation reopened' });
  } catch (err) {
    console.error('[Conversations] Reopen error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
