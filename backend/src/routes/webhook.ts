import { Router, Request, Response } from 'express';
import prisma from '../lib/prisma';
import {
  verifyWebhookSignature,
  parseIncomingMessage,
  parseStatusUpdates,
  WAWebhookPayload,
} from '../services/whatsapp';
import { processAutomations } from '../services/automation';
import { getIO } from '../lib/socket';
import { env } from '../config/env';

const router = Router();

// GET /webhook - WhatsApp webhook verification
router.get('/webhook', (req: Request, res: Response) => {
  const mode = req.query['hub.mode'] as string;
  const token = req.query['hub.verify_token'] as string;
  const challenge = req.query['hub.challenge'] as string;

  console.log(`[Webhook] Verification request: mode=${mode}, token=${token}`);

  const verifyToken = env.WA_VERIFY_TOKEN;

  if (mode === 'subscribe' && token === verifyToken) {
    console.log('[Webhook] Verification successful');
    return res.status(200).send(challenge);
  }

  console.warn('[Webhook] Verification failed: invalid token or mode');
  return res.status(403).json({ error: 'Forbidden: invalid verify token' });
});

// POST /webhook - Handle incoming WhatsApp messages and status updates
router.post('/webhook', async (req: Request, res: Response) => {
  // Always respond 200 immediately to acknowledge receipt
  // Meta will retry if we don't respond within 20 seconds
  res.status(200).json({ status: 'ok' });

  try {
    const payload = req.body as WAWebhookPayload;

    if (payload.object !== 'whatsapp_business_account') {
      console.log('[Webhook] Ignoring non-WhatsApp payload');
      return;
    }

    // Verify webhook signature if secret is configured
    const rawBody = (req as Request & { rawBody?: Buffer }).rawBody;
    const signature = req.headers['x-hub-signature-256'] as string;

    if (signature && rawBody) {
      // Find team by phone number ID to get their webhook secret
      const phoneNumberId =
        payload.entry?.[0]?.changes?.[0]?.value?.metadata?.phone_number_id;

      if (phoneNumberId) {
        const team = await prisma.team.findFirst({
          where: { waPhoneNumberId: phoneNumberId },
        });

        if (team?.waWebhookSecret) {
          const isValid = verifyWebhookSignature(rawBody, signature, team.waWebhookSecret);
          if (!isValid) {
            console.warn('[Webhook] Invalid signature for phone number ID:', phoneNumberId);
            return;
          }
        }
      }
    }

    // Handle status updates (message delivered, read, failed)
    const statusUpdates = parseStatusUpdates(payload);
    for (const statusUpdate of statusUpdates) {
      await handleStatusUpdate(statusUpdate);
    }

    // Handle incoming messages
    const incomingMessages = parseIncomingMessage(payload);
    for (const { message, phoneNumberId, contactName } of incomingMessages) {
      await handleIncomingMessage(message, phoneNumberId, contactName);
    }
  } catch (err) {
    console.error('[Webhook] Error processing payload:', err);
  }
});

async function handleStatusUpdate(
  statusUpdate: ReturnType<typeof parseStatusUpdates>[0]
): Promise<void> {
  try {
    const { id: waMessageId, status, timestamp, errors } = statusUpdate;

    // Find message by WA message ID
    const message = await prisma.message.findFirst({
      where: { waMessageId },
      include: { conversation: { select: { teamId: true } } },
    });

    if (!message) {
      console.log(`[Webhook] No message found for WA ID: ${waMessageId}`);
      return;
    }

    const newStatus =
      status === 'failed' ? 'failed' : status === 'read' ? 'read' : status;

    await prisma.message.update({
      where: { id: message.id },
      data: {
        status: newStatus,
        metadata: JSON.stringify({
          ...JSON.parse(message.metadata || '{}'),
          statusUpdatedAt: new Date(parseInt(timestamp) * 1000).toISOString(),
          waError: errors?.[0],
        }),
      },
    });

    // Emit socket event
    try {
      const io = getIO();
      io.to(`team:${message.conversation.teamId}`).emit('message:status', {
        messageId: message.id,
        waMessageId,
        status: newStatus,
        conversationId: message.conversationId,
      });
    } catch { /* socket not initialized */ }

    console.log(`[Webhook] Updated message ${message.id} status to ${newStatus}`);
  } catch (err) {
    console.error('[Webhook] Error handling status update:', err);
  }
}

async function handleIncomingMessage(
  parsed: ReturnType<typeof parseIncomingMessage>[0]['message'],
  phoneNumberId: string,
  contactName?: string
): Promise<void> {
  try {
    // Find team by phone number ID
    const team = await prisma.team.findFirst({
      where: { waPhoneNumberId: phoneNumberId },
    });

    if (!team) {
      console.log(`[Webhook] No team found for phone number ID: ${phoneNumberId}`);
      // In development/mock mode, use the first team
      const firstTeam = await prisma.team.findFirst();
      if (!firstTeam) {
        console.warn('[Webhook] No teams exist in database, ignoring message');
        return;
      }
      await processMessage(parsed, firstTeam.id, contactName);
      return;
    }

    await processMessage(parsed, team.id, contactName);
  } catch (err) {
    console.error('[Webhook] Error handling incoming message:', err);
  }
}

async function processMessage(
  parsed: ReturnType<typeof parseIncomingMessage>[0]['message'],
  teamId: string,
  contactName?: string
): Promise<void> {
  const { from: phone, messageId: waMessageId, type, text, mediaId, mediaCaption, mediaMimeType, latitude, longitude } = parsed;

  // Check for duplicate message (idempotency)
  const existingMsg = await prisma.message.findFirst({
    where: { waMessageId },
  });

  if (existingMsg) {
    console.log(`[Webhook] Duplicate message ignored: ${waMessageId}`);
    return;
  }

  // Upsert contact
  let contact = await prisma.contact.findUnique({
    where: { phone_teamId: { phone, teamId } },
  });

  if (!contact) {
    contact = await prisma.contact.create({
      data: {
        phone,
        name: contactName || phone,
        teamId,
        tags: '[]',
        customFields: '{}',
      },
    });
    console.log(`[Webhook] Created new contact: ${phone}`);
  } else if (contactName && !contact.name) {
    // Update name if we now have it
    contact = await prisma.contact.update({
      where: { id: contact.id },
      data: { name: contactName },
    });
  }

  if (contact.blocked) {
    console.log(`[Webhook] Message from blocked contact ignored: ${phone}`);
    return;
  }

  // Find or create open conversation
  let conversation = await prisma.conversation.findFirst({
    where: { contactId: contact.id, teamId, status: 'open' },
  });

  let isNewConversation = false;
  if (!conversation) {
    // Reopen resolved conversation or create new one
    const resolved = await prisma.conversation.findFirst({
      where: { contactId: contact.id, teamId, status: 'resolved' },
      orderBy: { createdAt: 'desc' },
    });

    if (resolved) {
      conversation = await prisma.conversation.update({
        where: { id: resolved.id },
        data: { status: 'open', lastMessageAt: new Date(), unreadCount: 1 },
      });
    } else {
      conversation = await prisma.conversation.create({
        data: {
          teamId,
          contactId: contact.id,
          lastMessageAt: new Date(),
          unreadCount: 1,
        },
      });
      isNewConversation = true;
    }
  } else {
    // Update unread count
    await prisma.conversation.update({
      where: { id: conversation.id },
      data: {
        lastMessageAt: new Date(),
        unreadCount: { increment: 1 },
      },
    });
  }

  // Build message content based on type
  let content: string | undefined;
  let messageType = type;

  switch (type) {
    case 'text':
      content = text;
      messageType = 'text';
      break;
    case 'image':
      content = mediaCaption;
      messageType = 'image';
      break;
    case 'audio':
      messageType = 'audio';
      break;
    case 'video':
      content = mediaCaption;
      messageType = 'video';
      break;
    case 'document':
      content = mediaCaption;
      messageType = 'file';
      break;
    case 'sticker':
      messageType = 'sticker';
      break;
    case 'location':
      content = latitude && longitude
        ? `Location: ${latitude}, ${longitude}${text ? ` (${text})` : ''}`
        : 'Location shared';
      messageType = 'location';
      break;
    default:
      content = text || `[${type}]`;
      messageType = 'text';
  }

  // Create the message
  const message = await prisma.message.create({
    data: {
      conversationId: conversation.id,
      fromType: 'contact',
      type: messageType,
      content,
      mediaUrl: mediaId ? `https://media.whatsapp.net/${mediaId}` : undefined,
      mediaMimeType,
      status: 'delivered',
      waMessageId,
      metadata: JSON.stringify({
        mediaId,
        latitude,
        longitude,
        contextMessageId: parsed.contextMessageId,
      }),
    },
  });

  console.log(`[Webhook] Saved message ${message.id} for conversation ${conversation.id}`);

  // Emit socket events
  try {
    const io = getIO();

    // Emit to conversation room
    io.to(`conversation:${conversation.id}`).emit('message:new', {
      message: {
        ...message,
        metadata: JSON.parse(message.metadata),
      },
      contact: {
        id: contact.id,
        name: contact.name,
        phone: contact.phone,
        avatar: contact.avatar,
      },
    });

    // Emit to team room (for notification badges etc.)
    io.to(`team:${teamId}`).emit('conversation:message', {
      conversationId: conversation.id,
      contactName: contact.name || contact.phone,
      message: {
        id: message.id,
        type: message.type,
        content: message.content,
        createdAt: message.createdAt,
      },
      unreadCount: conversation.unreadCount + 1,
    });

    if (isNewConversation) {
      io.to(`team:${teamId}`).emit('conversation:created', {
        conversation: {
          id: conversation.id,
          contact: {
            id: contact.id,
            name: contact.name,
            phone: contact.phone,
            avatar: contact.avatar,
          },
          status: conversation.status,
          createdAt: conversation.createdAt,
        },
      });
    }
  } catch { /* socket not initialized */ }

  // Process automations
  const triggerPromises: Promise<void>[] = [];

  if (isNewConversation) {
    triggerPromises.push(
      processAutomations({
        type: 'new_conversation',
        conversationId: conversation.id,
        teamId,
      })
    );
  }

  if (type === 'text' && text) {
    triggerPromises.push(
      processAutomations({
        type: 'keyword',
        conversationId: conversation.id,
        teamId,
        messageContent: text,
      })
    );
  }

  await Promise.allSettled(triggerPromises.map((p) => p.catch(console.error)));
}

export default router;
