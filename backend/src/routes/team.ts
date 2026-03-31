import { Router, Request, Response } from 'express';
import { z } from 'zod';
import bcrypt from 'bcryptjs';
import prisma from '../lib/prisma';
import { authenticate, requireRole } from '../middleware/auth';

const router = Router();
router.use(authenticate);

// GET /api/team
router.get('/', async (req: Request, res: Response) => {
  try {
    const team = await prisma.team.findUnique({
      where: { id: req.user!.teamId },
      include: {
        _count: {
          select: {
            users: true,
            contacts: true,
            conversations: true,
          },
        },
      },
    });

    if (!team) {
      return res.status(404).json({ error: 'Team not found' });
    }

    return res.json({
      team: {
        id: team.id,
        name: team.name,
        waPhoneNumberId: team.waPhoneNumberId,
        // Never expose the access token
        hasWaAccessToken: !!team.waAccessToken,
        waWebhookSecret: team.waWebhookSecret,
        createdAt: team.createdAt,
        _count: team._count,
      },
    });
  } catch (err) {
    console.error('[Team] Get error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// PATCH /api/team
router.patch('/', requireRole('admin'), async (req: Request, res: Response) => {
  try {
    const schema = z.object({
      name: z.string().min(2).optional(),
      waPhoneNumberId: z.string().optional().nullable(),
      waAccessToken: z.string().optional().nullable(),
      waWebhookSecret: z.string().optional().nullable(),
    });

    const parsed = schema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: 'Validation failed', details: parsed.error.errors });
    }

    const team = await prisma.team.update({
      where: { id: req.user!.teamId },
      data: parsed.data,
    });

    return res.json({
      team: {
        id: team.id,
        name: team.name,
        waPhoneNumberId: team.waPhoneNumberId,
        hasWaAccessToken: !!team.waAccessToken,
        waWebhookSecret: team.waWebhookSecret,
      },
      message: 'Team settings updated',
    });
  } catch (err) {
    console.error('[Team] Update error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/team/agents
router.get('/agents', async (req: Request, res: Response) => {
  try {
    const agents = await prisma.user.findMany({
      where: { teamId: req.user!.teamId },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        avatar: true,
        status: true,
        createdAt: true,
        _count: {
          select: { assignedConversations: true },
        },
      },
      orderBy: { createdAt: 'asc' },
    });

    return res.json({ agents });
  } catch (err) {
    console.error('[Team] List agents error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/team/agents/invite
router.post('/agents/invite', requireRole('admin', 'supervisor'), async (req: Request, res: Response) => {
  try {
    const schema = z.object({
      email: z.string().email(),
      name: z.string().min(2),
      role: z.enum(['agent', 'supervisor', 'admin']).default('agent'),
    });

    const parsed = schema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: 'Validation failed', details: parsed.error.errors });
    }

    const { email, name, role } = parsed.data;

    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      return res.status(409).json({ error: 'User with this email already exists' });
    }

    // Generate a temporary password (in production, send invite email)
    const tempPassword = Math.random().toString(36).slice(-10) + 'A1!';
    const hashedPassword = await bcrypt.hash(tempPassword, 12);

    const agent = await prisma.user.create({
      data: {
        email,
        name,
        role,
        password: hashedPassword,
        teamId: req.user!.teamId,
        status: 'offline',
      },
    });

    return res.status(201).json({
      agent: {
        id: agent.id,
        email: agent.email,
        name: agent.name,
        role: agent.role,
        status: agent.status,
      },
      tempPassword, // In production, send this via email instead
      message: 'Agent invited successfully. Share the temporary password securely.',
    });
  } catch (err) {
    console.error('[Team] Invite agent error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// PATCH /api/team/agents/:id
router.patch('/agents/:id', requireRole('admin'), async (req: Request, res: Response) => {
  try {
    const agent = await prisma.user.findFirst({
      where: { id: req.params.id, teamId: req.user!.teamId },
    });

    if (!agent) {
      return res.status(404).json({ error: 'Agent not found in this team' });
    }

    const schema = z.object({
      role: z.enum(['agent', 'supervisor', 'admin']).optional(),
      status: z.enum(['online', 'offline', 'busy']).optional(),
      name: z.string().min(2).optional(),
    });

    const parsed = schema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: 'Validation failed', details: parsed.error.errors });
    }

    // Prevent removing the last admin
    if (parsed.data.role && parsed.data.role !== 'admin' && agent.role === 'admin') {
      const adminCount = await prisma.user.count({
        where: { teamId: req.user!.teamId, role: 'admin' },
      });
      if (adminCount <= 1) {
        return res.status(400).json({ error: 'Cannot remove the last admin from the team' });
      }
    }

    const updated = await prisma.user.update({
      where: { id: req.params.id },
      data: parsed.data,
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        avatar: true,
        status: true,
      },
    });

    return res.json({ agent: updated });
  } catch (err) {
    console.error('[Team] Update agent error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/team/agents/:id/reset-password
router.post('/agents/:id/reset-password', requireRole('admin'), async (req: Request, res: Response) => {
  try {
    const agent = await prisma.user.findFirst({
      where: { id: req.params.id, teamId: req.user!.teamId },
    });

    if (!agent) {
      return res.status(404).json({ error: 'Agent not found in this team' });
    }

    const tempPassword = Math.random().toString(36).slice(-8) + 'A1!';
    const hashedPassword = await bcrypt.hash(tempPassword, 12);

    await prisma.user.update({
      where: { id: req.params.id },
      data: { password: hashedPassword },
    });

    return res.json({
      tempPassword,
      message: 'Password reset successfully. Share the temporary password with the agent.',
    });
  } catch (err) {
    console.error('[Team] Reset password error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// DELETE /api/team/agents/:id
router.delete('/agents/:id', requireRole('admin'), async (req: Request, res: Response) => {
  try {
    const agent = await prisma.user.findFirst({
      where: { id: req.params.id, teamId: req.user!.teamId },
    });

    if (!agent) {
      return res.status(404).json({ error: 'Agent not found in this team' });
    }

    if (agent.id === req.user!.id) {
      return res.status(400).json({ error: 'Cannot remove yourself from the team' });
    }

    // Check last admin constraint
    if (agent.role === 'admin') {
      const adminCount = await prisma.user.count({
        where: { teamId: req.user!.teamId, role: 'admin' },
      });
      if (adminCount <= 1) {
        return res.status(400).json({ error: 'Cannot remove the last admin from the team' });
      }
    }

    // Unassign conversations before deletion
    await prisma.conversation.updateMany({
      where: { assignedToId: agent.id },
      data: { assignedToId: null },
    });

    await prisma.user.delete({ where: { id: req.params.id } });

    return res.json({ message: 'Agent removed from team' });
  } catch (err) {
    console.error('[Team] Delete agent error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/team/labels
router.get('/labels', async (req: Request, res: Response) => {
  try {
    const labels = await prisma.label.findMany({
      where: { teamId: req.user!.teamId },
      orderBy: { createdAt: 'asc' },
      include: {
        _count: { select: { conversations: true } },
      },
    });

    return res.json({ labels });
  } catch (err) {
    console.error('[Team] List labels error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/team/labels
router.post('/labels', async (req: Request, res: Response) => {
  try {
    const schema = z.object({
      name: z.string().min(1).max(50),
      color: z.string().regex(/^#[0-9a-fA-F]{6}$/, 'Color must be a valid hex color').default('#6366f1'),
    });

    const parsed = schema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: 'Validation failed', details: parsed.error.errors });
    }

    const label = await prisma.label.create({
      data: {
        ...parsed.data,
        teamId: req.user!.teamId,
      },
    });

    return res.status(201).json({ label });
  } catch (err) {
    console.error('[Team] Create label error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// PATCH /api/team/labels/:id
router.patch('/labels/:id', async (req: Request, res: Response) => {
  try {
    const existing = await prisma.label.findFirst({
      where: { id: req.params.id, teamId: req.user!.teamId },
    });

    if (!existing) {
      return res.status(404).json({ error: 'Label not found' });
    }

    const schema = z.object({
      name: z.string().min(1).max(50).optional(),
      color: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
    });

    const parsed = schema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: 'Validation failed', details: parsed.error.errors });
    }

    const label = await prisma.label.update({
      where: { id: req.params.id },
      data: parsed.data,
    });

    return res.json({ label });
  } catch (err) {
    console.error('[Team] Update label error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// DELETE /api/team/labels/:id
router.delete('/labels/:id', async (req: Request, res: Response) => {
  try {
    const existing = await prisma.label.findFirst({
      where: { id: req.params.id, teamId: req.user!.teamId },
    });

    if (!existing) {
      return res.status(404).json({ error: 'Label not found' });
    }

    await prisma.label.delete({ where: { id: req.params.id } });

    return res.json({ message: 'Label deleted' });
  } catch (err) {
    console.error('[Team] Delete label error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/team/canned-responses
router.get('/canned-responses', async (req: Request, res: Response) => {
  try {
    const { search } = req.query as Record<string, string>;

    const where: Record<string, unknown> = { teamId: req.user!.teamId };
    if (search) {
      where.OR = [
        { shortcut: { contains: search } },
        { content: { contains: search } },
      ];
    }

    const responses = await prisma.cannedResponse.findMany({
      where,
      orderBy: { shortcut: 'asc' },
    });

    return res.json({ cannedResponses: responses });
  } catch (err) {
    console.error('[Team] List canned responses error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/team/canned-responses
router.post('/canned-responses', async (req: Request, res: Response) => {
  try {
    const schema = z.object({
      shortcut: z
        .string()
        .min(1)
        .max(50)
        .regex(/^[a-zA-Z0-9_-]+$/, 'Shortcut must be alphanumeric with hyphens/underscores'),
      content: z.string().min(1),
    });

    const parsed = schema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: 'Validation failed', details: parsed.error.errors });
    }

    // Check for duplicate shortcut
    const existing = await prisma.cannedResponse.findFirst({
      where: { shortcut: parsed.data.shortcut, teamId: req.user!.teamId },
    });

    if (existing) {
      return res.status(409).json({ error: 'A canned response with this shortcut already exists' });
    }

    const response = await prisma.cannedResponse.create({
      data: {
        ...parsed.data,
        teamId: req.user!.teamId,
      },
    });

    return res.status(201).json({ cannedResponse: response });
  } catch (err) {
    console.error('[Team] Create canned response error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// PATCH /api/team/canned-responses/:id
router.patch('/canned-responses/:id', async (req: Request, res: Response) => {
  try {
    const existing = await prisma.cannedResponse.findFirst({
      where: { id: req.params.id, teamId: req.user!.teamId },
    });

    if (!existing) {
      return res.status(404).json({ error: 'Canned response not found' });
    }

    const schema = z.object({
      shortcut: z
        .string()
        .min(1)
        .max(50)
        .regex(/^[a-zA-Z0-9_-]+$/)
        .optional(),
      content: z.string().min(1).optional(),
    });

    const parsed = schema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: 'Validation failed', details: parsed.error.errors });
    }

    const response = await prisma.cannedResponse.update({
      where: { id: req.params.id },
      data: parsed.data,
    });

    return res.json({ cannedResponse: response });
  } catch (err) {
    console.error('[Team] Update canned response error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// DELETE /api/team/canned-responses/:id
router.delete('/canned-responses/:id', async (req: Request, res: Response) => {
  try {
    const existing = await prisma.cannedResponse.findFirst({
      where: { id: req.params.id, teamId: req.user!.teamId },
    });

    if (!existing) {
      return res.status(404).json({ error: 'Canned response not found' });
    }

    await prisma.cannedResponse.delete({ where: { id: req.params.id } });

    return res.json({ message: 'Canned response deleted' });
  } catch (err) {
    console.error('[Team] Delete canned response error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
