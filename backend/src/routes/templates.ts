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

// Map short language codes to Meta locale codes
const LANGUAGE_MAP: Record<string, string> = {
  en: 'en_US',
  id: 'id',
  es: 'es',
  pt_BR: 'pt_BR',
  fr: 'fr',
  ar: 'ar',
};

interface MetaSubmitResult {
  waTemplateId: string | null;
  status: string;
  errorMessage?: string;
}

async function submitToMeta(template: {
  name: string;
  category: string;
  language: string;
  headerType?: string | null;
  headerValue?: string | null;
  body: string;
  footer?: string | null;
  buttons: string; // JSON string
}): Promise<MetaSubmitResult> {
  const accessToken = process.env.WA_ACCESS_TOKEN;
  const wabaId = process.env.WA_BUSINESS_ACCOUNT_ID;

  if (!accessToken || !wabaId) {
    // No credentials — local-only mode
    return { waTemplateId: null, status: 'pending' };
  }

  const metaLanguage = LANGUAGE_MAP[template.language] || template.language;

  const components: Array<Record<string, unknown>> = [];

  if (template.headerType) {
    const format = template.headerType.toUpperCase();
    const headerComp: Record<string, unknown> = { type: 'HEADER', format };
    if (format === 'TEXT' && template.headerValue) {
      headerComp.text = template.headerValue;
    }
    components.push(headerComp);
  }

  components.push({ type: 'BODY', text: template.body });

  if (template.footer) {
    components.push({ type: 'FOOTER', text: template.footer });
  }

  let buttons: Array<Record<string, unknown>> = [];
  try { buttons = JSON.parse(template.buttons) || []; } catch { /* ignore */ }

  if (buttons.length > 0) {
    components.push({
      type: 'BUTTONS',
      buttons: buttons.map((b) => {
        const btn: Record<string, unknown> = { type: String(b.type).toUpperCase(), text: b.text };
        if (b.url) btn.url = b.url;
        if (b.phone_number) btn.phone_number = b.phone_number;
        return btn;
      }),
    });
  }

  const payload = {
    name: template.name,
    language: metaLanguage,
    category: template.category.toUpperCase(),
    components,
  };

  console.log('[Templates] Submitting to Meta:', JSON.stringify(payload, null, 2));

  try {
    const response = await fetch(
      `https://graph.facebook.com/v21.0/${wabaId}/message_templates`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify(payload),
      }
    );

    const data = await response.json() as Record<string, unknown>;

    if (!response.ok) {
      const errMsg = (data.error as Record<string, unknown>)?.message as string || JSON.stringify(data);
      console.error(`[Templates] Meta rejected template "${template.name}":`, JSON.stringify(data));
      return { waTemplateId: null, status: 'rejected', errorMessage: errMsg };
    }

    const waTemplateId = data.id as string | null || null;
    const metaStatus = (data.status as string || 'PENDING').toUpperCase();
    const STATUS_MAP: Record<string, string> = { APPROVED: 'approved', REJECTED: 'rejected', PENDING: 'pending' };
    const status = STATUS_MAP[metaStatus] || 'pending';

    console.log(`[Templates] Meta accepted "${template.name}" → id=${waTemplateId}, status=${metaStatus}`);
    return { waTemplateId, status };
  } catch (err) {
    console.error('[Templates] Meta API exception:', err);
    return { waTemplateId: null, status: 'pending', errorMessage: String(err) };
  }
}

function parseButtons(raw: string) {
  try { return JSON.parse(raw); } catch { return []; }
}

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
      templates: templates.map((t) => ({ ...t, buttons: parseButtons(t.buttons) })),
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

    const existing = await prisma.template.findFirst({
      where: { name: rest.name, teamId: req.user!.teamId },
    });
    if (existing) {
      return res.status(409).json({ error: 'A template with this name already exists' });
    }

    // Save locally first
    let template = await prisma.template.create({
      data: {
        ...rest,
        buttons: JSON.stringify(buttons || []),
        teamId: req.user!.teamId,
        status: 'pending',
      },
    });

    // Submit to Meta (no-op if credentials not set)
    const metaResult = await submitToMeta({
      name: template.name,
      category: template.category,
      language: template.language,
      headerType: template.headerType,
      headerValue: template.headerValue,
      body: template.body,
      footer: template.footer,
      buttons: template.buttons,
    });

    if (metaResult.waTemplateId || metaResult.status !== 'pending' || metaResult.errorMessage) {
      template = await prisma.template.update({
        where: { id: template.id },
        data: {
          status: metaResult.status,
          waTemplateId: metaResult.waTemplateId || undefined,
        },
      });
    }

    const submittedToMeta = !!(process.env.WA_ACCESS_TOKEN && process.env.WA_BUSINESS_ACCOUNT_ID);

    return res.status(201).json({
      template: { ...template, buttons: parseButtons(template.buttons) },
      submittedToMeta,
      metaStatus: metaResult.status,
      metaError: metaResult.errorMessage,
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

    return res.json({ template: { ...template, buttons: parseButtons(template.buttons) } });
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
      data: { ...updateData, status: 'pending' },
    });

    return res.json({ template: { ...updated, buttons: parseButtons(updated.buttons) } });
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

    // Delete from Meta if we have credentials and the template was submitted
    const accessToken = process.env.WA_ACCESS_TOKEN;
    const wabaId = process.env.WA_BUSINESS_ACCOUNT_ID;

    if (accessToken && wabaId && template.waTemplateId) {
      try {
        const url = `https://graph.facebook.com/v21.0/${wabaId}/message_templates?name=${encodeURIComponent(template.name)}`;
        const metaRes = await fetch(url, {
          method: 'DELETE',
          headers: { Authorization: `Bearer ${accessToken}` },
        });
        if (!metaRes.ok) {
          const errBody = await metaRes.json().catch(() => ({}));
          console.warn(`[Templates] Meta delete warning for "${template.name}":`, errBody);
          // Continue with local deletion even if Meta delete fails
        } else {
          console.log(`[Templates] Deleted "${template.name}" from Meta`);
        }
      } catch (err) {
        console.warn('[Templates] Meta delete exception (continuing with local delete):', err);
      }
    }

    await prisma.template.delete({ where: { id: req.params.id } });

    return res.json({ message: 'Template deleted successfully' });
  } catch (err) {
    console.error('[Templates] Delete error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/templates/sync — pull templates from Meta and upsert locally
router.post('/sync', async (req: Request, res: Response) => {
  try {
    const accessToken = process.env.WA_ACCESS_TOKEN;
    const wabaId = process.env.WA_BUSINESS_ACCOUNT_ID;

    if (!accessToken || !wabaId) {
      return res.status(503).json({
        error: 'WhatsApp credentials not configured. Set WA_ACCESS_TOKEN and WA_BUSINESS_ACCOUNT_ID.',
      });
    }

    const url = `https://graph.facebook.com/v21.0/${wabaId}/message_templates?limit=100&fields=id,name,status,category,language,components`;
    const metaRes = await fetch(url, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    if (!metaRes.ok) {
      const errBody = await metaRes.json().catch(() => ({}));
      console.error('[Templates] Meta API error during sync:', errBody);
      return res.status(502).json({ error: 'Meta API request failed', details: errBody });
    }

    type MetaComponent = {
      type: string;
      format?: string;
      text?: string;
      buttons?: Array<{ type: string; text: string; url?: string; phone_number?: string }>;
    };
    type MetaTemplate = {
      id: string;
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
      if (!bodyComp?.text) continue;

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

      const STATUS_MAP: Record<string, string> = {
        APPROVED: 'approved',
        REJECTED: 'rejected',
        PENDING: 'pending',
        PAUSED: 'pending',
        DISABLED: 'rejected',
      };
      const status = STATUS_MAP[t.status.toUpperCase()] ?? 'pending';

      const validCategories = ['MARKETING', 'UTILITY', 'AUTHENTICATION'];
      const category = validCategories.includes(t.category.toUpperCase()) ? t.category.toUpperCase() : 'UTILITY';

      const existing = await prisma.template.findFirst({ where: { name: t.name, teamId } });

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
            waTemplateId: t.id,
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
            waTemplateId: t.id,
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

// POST /api/templates/:id/submit — submit a locally-created template to Meta
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

    const metaResult = await submitToMeta({
      name: template.name,
      category: template.category,
      language: template.language,
      headerType: template.headerType,
      headerValue: template.headerValue,
      body: template.body,
      footer: template.footer,
      buttons: template.buttons,
    });

    const updated = await prisma.template.update({
      where: { id: req.params.id },
      data: {
        status: metaResult.status,
        waTemplateId: metaResult.waTemplateId || undefined,
      },
    });

    const submittedToMeta = !!(process.env.WA_ACCESS_TOKEN && process.env.WA_BUSINESS_ACCOUNT_ID);

    return res.json({
      template: { ...updated, buttons: parseButtons(updated.buttons) },
      submittedToMeta,
      metaStatus: metaResult.status,
      metaError: metaResult.errorMessage,
      message: submittedToMeta
        ? 'Template submitted to WhatsApp for approval'
        : 'Template marked as pending (no WhatsApp credentials configured)',
    });
  } catch (err) {
    console.error('[Templates] Submit error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
