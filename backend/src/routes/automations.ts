import { Router, Request, Response } from 'express';
import { z } from 'zod';
import prisma from '../lib/prisma';
import { authenticate } from '../middleware/auth';

const router = Router();
router.use(authenticate);

const triggerSchema = z.object({
  type: z.enum(['keyword', 'new_conversation', 'no_reply', 'label_added', 'conversation_resolved']),
  value: z.string().optional(),
});

const actionSchema = z.object({
  type: z.enum([
    'send_message',
    'assign_to',
    'add_label',
    'remove_label',
    'resolve',
    'reopen',
    'send_template',
    'add_tag',
    'set_priority',
  ]),
  value: z.union([z.string(), z.number(), z.object({}).passthrough(), z.null()]).optional(),
});

const automationSchema = z.object({
  name: z.string().min(1),
  isActive: z.boolean().default(true),
  trigger: triggerSchema,
  actions: z.array(actionSchema).min(1, 'At least one action is required'),
});

// GET /api/automations
router.get('/', async (req: Request, res: Response) => {
  try {
    const automations = await prisma.automation.findMany({
      where: { teamId: req.user!.teamId },
      orderBy: { createdAt: 'desc' },
    });

    return res.json({
      automations: automations.map((a) => ({
        ...a,
        trigger: (() => { try { return JSON.parse(a.trigger); } catch { return {}; } })(),
        actions: (() => { try { return JSON.parse(a.actions); } catch { return []; } })(),
      })),
    });
  } catch (err) {
    console.error('[Automations] List error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/automations
router.post('/', async (req: Request, res: Response) => {
  try {
    const parsed = automationSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: 'Validation failed', details: parsed.error.errors });
    }

    const { trigger, actions, ...rest } = parsed.data;

    const automation = await prisma.automation.create({
      data: {
        ...rest,
        trigger: JSON.stringify(trigger),
        actions: JSON.stringify(actions),
        teamId: req.user!.teamId,
      },
    });

    return res.status(201).json({
      automation: {
        ...automation,
        trigger,
        actions,
      },
    });
  } catch (err) {
    console.error('[Automations] Create error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/automations/:id
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const automation = await prisma.automation.findFirst({
      where: { id: req.params.id, teamId: req.user!.teamId },
    });

    if (!automation) {
      return res.status(404).json({ error: 'Automation not found' });
    }

    return res.json({
      automation: {
        ...automation,
        trigger: (() => { try { return JSON.parse(automation.trigger); } catch { return {}; } })(),
        actions: (() => { try { return JSON.parse(automation.actions); } catch { return []; } })(),
      },
    });
  } catch (err) {
    console.error('[Automations] Get error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// PATCH /api/automations/:id
router.patch('/:id', async (req: Request, res: Response) => {
  try {
    const existing = await prisma.automation.findFirst({
      where: { id: req.params.id, teamId: req.user!.teamId },
    });

    if (!existing) {
      return res.status(404).json({ error: 'Automation not found' });
    }

    const updateSchema = automationSchema.partial();
    const parsed = updateSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: 'Validation failed', details: parsed.error.errors });
    }

    const { trigger, actions, ...rest } = parsed.data;
    const updateData: Record<string, unknown> = { ...rest };

    if (trigger !== undefined) updateData.trigger = JSON.stringify(trigger);
    if (actions !== undefined) updateData.actions = JSON.stringify(actions);

    const automation = await prisma.automation.update({
      where: { id: req.params.id },
      data: updateData,
    });

    return res.json({
      automation: {
        ...automation,
        trigger: (() => { try { return JSON.parse(automation.trigger); } catch { return {}; } })(),
        actions: (() => { try { return JSON.parse(automation.actions); } catch { return []; } })(),
      },
    });
  } catch (err) {
    console.error('[Automations] Update error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// DELETE /api/automations/:id
router.delete('/:id', async (req: Request, res: Response) => {
  try {
    const automation = await prisma.automation.findFirst({
      where: { id: req.params.id, teamId: req.user!.teamId },
    });

    if (!automation) {
      return res.status(404).json({ error: 'Automation not found' });
    }

    await prisma.automation.delete({ where: { id: req.params.id } });

    return res.json({ message: 'Automation deleted' });
  } catch (err) {
    console.error('[Automations] Delete error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/automations/:id/toggle
router.post('/:id/toggle', async (req: Request, res: Response) => {
  try {
    const automation = await prisma.automation.findFirst({
      where: { id: req.params.id, teamId: req.user!.teamId },
    });

    if (!automation) {
      return res.status(404).json({ error: 'Automation not found' });
    }

    const updated = await prisma.automation.update({
      where: { id: req.params.id },
      data: { isActive: !automation.isActive },
    });

    return res.json({
      automation: {
        ...updated,
        trigger: (() => { try { return JSON.parse(updated.trigger); } catch { return {}; } })(),
        actions: (() => { try { return JSON.parse(updated.actions); } catch { return []; } })(),
      },
      message: updated.isActive ? 'Automation activated' : 'Automation deactivated',
    });
  } catch (err) {
    console.error('[Automations] Toggle error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
