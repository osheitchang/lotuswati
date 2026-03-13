import crypto from 'crypto';
import { v4 as uuidv4 } from 'uuid';

// Types for WhatsApp API interactions
export interface WAMessageComponent {
  type: 'header' | 'body' | 'button';
  parameters?: WAParameter[];
  sub_type?: string;
  index?: number;
}

export interface WAParameter {
  type: 'text' | 'image' | 'video' | 'document' | 'currency' | 'date_time';
  text?: string;
  image?: { link: string };
  video?: { link: string };
  document?: { link: string };
}

export interface WAIncomingMessage {
  messageId: string;
  from: string;
  timestamp: string;
  type: string;
  text?: string;
  mediaId?: string;
  mediaUrl?: string;
  mediaMimeType?: string;
  mediaCaption?: string;
  latitude?: number;
  longitude?: number;
  contactName?: string;
  contextMessageId?: string;
}

export interface WAWebhookPayload {
  object: string;
  entry: WAEntry[];
}

export interface WAEntry {
  id: string;
  changes: WAChange[];
}

export interface WAChange {
  value: WAChangeValue;
  field: string;
}

export interface WAChangeValue {
  messaging_product: string;
  metadata: {
    display_phone_number: string;
    phone_number_id: string;
  };
  contacts?: Array<{
    profile: { name: string };
    wa_id: string;
  }>;
  messages?: WARawMessage[];
  statuses?: WAStatusUpdate[];
}

export interface WARawMessage {
  from: string;
  id: string;
  timestamp: string;
  type: string;
  text?: { body: string };
  image?: { id: string; mime_type: string; sha256: string; caption?: string };
  audio?: { id: string; mime_type: string; sha256: string; voice?: boolean };
  video?: { id: string; mime_type: string; sha256: string; caption?: string };
  document?: { id: string; filename: string; mime_type: string; sha256: string; caption?: string };
  sticker?: { id: string; mime_type: string; sha256: string; animated: boolean };
  location?: { latitude: number; longitude: number; name?: string; address?: string };
  contacts?: Array<{ name: { formatted_name: string } }>;
  interactive?: {
    type: string;
    button_reply?: { id: string; title: string };
    list_reply?: { id: string; title: string; description: string };
  };
  context?: { from: string; id: string };
}

export interface WAStatusUpdate {
  id: string;
  status: 'sent' | 'delivered' | 'read' | 'failed';
  timestamp: string;
  recipient_id: string;
  errors?: Array<{ code: number; title: string }>;
}

const MOCK_MODE = !process.env.WA_ACCESS_TOKEN;

/**
 * Send a text message via WhatsApp Business Cloud API
 * In mock mode, logs the message and returns a fake WA message ID
 */
export async function sendTextMessage(
  to: string,
  text: string,
  teamId: string
): Promise<{ messageId: string; success: boolean }> {
  const mockMessageId = `wamid.mock_${uuidv4().replace(/-/g, '')}`;

  if (MOCK_MODE) {
    console.log(`[WhatsApp Mock] Sending text message to ${to}:`);
    console.log(`  Team: ${teamId}`);
    console.log(`  Message: ${text}`);
    console.log(`  Mock WA Message ID: ${mockMessageId}`);

    // Simulate a small delay as if calling the API
    await new Promise((resolve) => setTimeout(resolve, 50));

    return { messageId: mockMessageId, success: true };
  }

  try {
    const phoneNumberId = process.env.WA_PHONE_NUMBER_ID;
    const accessToken = process.env.WA_ACCESS_TOKEN;

    const response = await fetch(
      `https://graph.facebook.com/v18.0/${phoneNumberId}/messages`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
          messaging_product: 'whatsapp',
          recipient_type: 'individual',
          to,
          type: 'text',
          text: { preview_url: false, body: text },
        }),
      }
    );

    if (!response.ok) {
      const errorData = await response.json();
      console.error('[WhatsApp API] Send text error:', errorData);
      return { messageId: '', success: false };
    }

    const data = await response.json() as { messages: Array<{ id: string }> };
    return { messageId: data.messages[0]?.id || mockMessageId, success: true };
  } catch (err) {
    console.error('[WhatsApp API] Send text exception:', err);
    return { messageId: '', success: false };
  }
}

/**
 * Send a template message via WhatsApp Business Cloud API
 */
export async function sendTemplateMessage(
  to: string,
  templateName: string,
  language: string,
  components: WAMessageComponent[],
  teamId: string
): Promise<{ messageId: string; success: boolean }> {
  const mockMessageId = `wamid.mock_${uuidv4().replace(/-/g, '')}`;

  if (MOCK_MODE) {
    console.log(`[WhatsApp Mock] Sending template message to ${to}:`);
    console.log(`  Team: ${teamId}`);
    console.log(`  Template: ${templateName} (${language})`);
    console.log(`  Components: ${JSON.stringify(components, null, 2)}`);
    console.log(`  Mock WA Message ID: ${mockMessageId}`);

    await new Promise((resolve) => setTimeout(resolve, 50));

    return { messageId: mockMessageId, success: true };
  }

  try {
    const phoneNumberId = process.env.WA_PHONE_NUMBER_ID;
    const accessToken = process.env.WA_ACCESS_TOKEN;

    const response = await fetch(
      `https://graph.facebook.com/v18.0/${phoneNumberId}/messages`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
          messaging_product: 'whatsapp',
          to,
          type: 'template',
          template: {
            name: templateName,
            language: { code: language },
            components,
          },
        }),
      }
    );

    if (!response.ok) {
      const errorData = await response.json();
      console.error('[WhatsApp API] Send template error:', errorData);
      return { messageId: '', success: false };
    }

    const data = await response.json() as { messages: Array<{ id: string }> };
    return { messageId: data.messages[0]?.id || mockMessageId, success: true };
  } catch (err) {
    console.error('[WhatsApp API] Send template exception:', err);
    return { messageId: '', success: false };
  }
}

/**
 * Send a media message (image, audio, video, document) via WhatsApp Business Cloud API
 */
export async function sendMediaMessage(
  to: string,
  type: 'image' | 'audio' | 'video' | 'document' | 'sticker',
  url: string,
  caption: string | undefined,
  teamId: string,
  filename?: string
): Promise<{ messageId: string; success: boolean }> {
  const mockMessageId = `wamid.mock_${uuidv4().replace(/-/g, '')}`;

  if (MOCK_MODE) {
    console.log(`[WhatsApp Mock] Sending ${type} message to ${to}:`);
    console.log(`  Team: ${teamId}`);
    console.log(`  URL: ${url}`);
    if (caption) console.log(`  Caption: ${caption}`);
    console.log(`  Mock WA Message ID: ${mockMessageId}`);

    await new Promise((resolve) => setTimeout(resolve, 50));

    return { messageId: mockMessageId, success: true };
  }

  try {
    const phoneNumberId = process.env.WA_PHONE_NUMBER_ID;
    const accessToken = process.env.WA_ACCESS_TOKEN;

    const mediaObject: Record<string, string | undefined> = { link: url };
    if (caption && ['image', 'video', 'document'].includes(type)) {
      mediaObject.caption = caption;
    }
    if (type === 'document' && filename) {
      mediaObject.filename = filename;
    }

    const response = await fetch(
      `https://graph.facebook.com/v18.0/${phoneNumberId}/messages`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
          messaging_product: 'whatsapp',
          recipient_type: 'individual',
          to,
          type,
          [type]: mediaObject,
        }),
      }
    );

    if (!response.ok) {
      const errorData = await response.json();
      console.error(`[WhatsApp API] Send ${type} error:`, errorData);
      return { messageId: '', success: false };
    }

    const data = await response.json() as { messages: Array<{ id: string }> };
    return { messageId: data.messages[0]?.id || mockMessageId, success: true };
  } catch (err) {
    console.error(`[WhatsApp API] Send ${type} exception:`, err);
    return { messageId: '', success: false };
  }
}

/**
 * Verify WhatsApp webhook signature using HMAC-SHA256
 * This is real signature verification, not mocked
 */
export function verifyWebhookSignature(
  payload: string | Buffer,
  signature: string,
  secret: string
): boolean {
  if (!signature || !secret) {
    console.warn('[WhatsApp] Missing signature or secret for webhook verification');
    return false;
  }

  try {
    // Meta sends the signature as "sha256=<hash>"
    const expectedSignature = signature.startsWith('sha256=')
      ? signature
      : `sha256=${signature}`;

    const hmac = crypto.createHmac('sha256', secret);
    hmac.update(payload);
    const computedHash = `sha256=${hmac.digest('hex')}`;

    // Use timingSafeEqual to prevent timing attacks
    const expectedBuffer = Buffer.from(expectedSignature, 'utf8');
    const computedBuffer = Buffer.from(computedHash, 'utf8');

    if (expectedBuffer.length !== computedBuffer.length) {
      return false;
    }

    return crypto.timingSafeEqual(expectedBuffer, computedBuffer);
  } catch (err) {
    console.error('[WhatsApp] Signature verification error:', err);
    return false;
  }
}

/**
 * Parse incoming Meta webhook payload into a normalized format
 */
export function parseIncomingMessage(
  webhookPayload: WAWebhookPayload
): Array<{
  message: WAIncomingMessage;
  phoneNumberId: string;
  contactName?: string;
}> {
  const results: Array<{
    message: WAIncomingMessage;
    phoneNumberId: string;
    contactName?: string;
  }> = [];

  for (const entry of webhookPayload.entry || []) {
    for (const change of entry.changes || []) {
      if (change.field !== 'messages') continue;

      const value = change.value;
      const phoneNumberId = value.metadata?.phone_number_id;

      // Build contact name map
      const contactNames: Record<string, string> = {};
      for (const contact of value.contacts || []) {
        contactNames[contact.wa_id] = contact.profile?.name || '';
      }

      for (const rawMsg of value.messages || []) {
        const parsed: WAIncomingMessage = {
          messageId: rawMsg.id,
          from: rawMsg.from,
          timestamp: rawMsg.timestamp,
          type: rawMsg.type,
          contactName: contactNames[rawMsg.from],
        };

        // Parse message content based on type
        switch (rawMsg.type) {
          case 'text':
            parsed.text = rawMsg.text?.body;
            break;

          case 'image':
            parsed.mediaId = rawMsg.image?.id;
            parsed.mediaMimeType = rawMsg.image?.mime_type;
            parsed.mediaCaption = rawMsg.image?.caption;
            break;

          case 'audio':
            parsed.mediaId = rawMsg.audio?.id;
            parsed.mediaMimeType = rawMsg.audio?.mime_type;
            break;

          case 'video':
            parsed.mediaId = rawMsg.video?.id;
            parsed.mediaMimeType = rawMsg.video?.mime_type;
            parsed.mediaCaption = rawMsg.video?.caption;
            break;

          case 'document':
            parsed.mediaId = rawMsg.document?.id;
            parsed.mediaMimeType = rawMsg.document?.mime_type;
            parsed.mediaCaption = rawMsg.document?.caption;
            break;

          case 'sticker':
            parsed.mediaId = rawMsg.sticker?.id;
            parsed.mediaMimeType = rawMsg.sticker?.mime_type;
            break;

          case 'location':
            parsed.latitude = rawMsg.location?.latitude;
            parsed.longitude = rawMsg.location?.longitude;
            parsed.text = rawMsg.location?.name || rawMsg.location?.address;
            break;

          case 'contacts':
            parsed.contactName = rawMsg.contacts?.[0]?.name?.formatted_name;
            break;

          case 'interactive':
            if (rawMsg.interactive?.type === 'button_reply') {
              parsed.text = rawMsg.interactive.button_reply?.title;
            } else if (rawMsg.interactive?.type === 'list_reply') {
              parsed.text = rawMsg.interactive.list_reply?.title;
            }
            break;

          default:
            parsed.text = `[Unsupported message type: ${rawMsg.type}]`;
        }

        // Check for context (reply)
        if (rawMsg.context?.id) {
          parsed.contextMessageId = rawMsg.context.id;
        }

        results.push({
          message: parsed,
          phoneNumberId,
          contactName: contactNames[rawMsg.from],
        });
      }
    }
  }

  return results;
}

/**
 * Parse status updates from Meta webhook
 */
export function parseStatusUpdates(
  webhookPayload: WAWebhookPayload
): WAStatusUpdate[] {
  const statuses: WAStatusUpdate[] = [];

  for (const entry of webhookPayload.entry || []) {
    for (const change of entry.changes || []) {
      if (change.field !== 'messages') continue;
      for (const status of change.value.statuses || []) {
        statuses.push(status);
      }
    }
  }

  return statuses;
}
