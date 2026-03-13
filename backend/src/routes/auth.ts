import { Router, Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { z } from 'zod';
import prisma from '../lib/prisma';
import { authenticate } from '../middleware/auth';

const router = Router();

const registerSchema = z.object({
  teamName: z.string().min(2, 'Team name must be at least 2 characters'),
  name: z.string().min(2, 'Name must be at least 2 characters'),
  email: z.string().email('Invalid email address'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
});

const loginSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(1, 'Password is required'),
});

function generateToken(payload: { id: string; email: string; teamId: string; role: string }): string {
  const jwtSecret = process.env.JWT_SECRET || 'lotuswati-super-secret-key-change-in-production';
  return jwt.sign(payload, jwtSecret, { expiresIn: '7d' });
}

// POST /api/auth/register
router.post('/register', async (req: Request, res: Response) => {
  try {
    const parsed = registerSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        error: 'Validation failed',
        details: parsed.error.errors,
      });
    }

    const { teamName, name, email, password } = parsed.data;

    // Check if email already exists
    const existingUser = await prisma.user.findUnique({ where: { email } });
    if (existingUser) {
      return res.status(409).json({ error: 'Email already registered' });
    }

    const hashedPassword = await bcrypt.hash(password, 12);

    // Create team and admin user in a transaction
    const result = await prisma.$transaction(async (tx) => {
      const team = await tx.team.create({
        data: { name: teamName },
      });

      const user = await tx.user.create({
        data: {
          email,
          password: hashedPassword,
          name,
          role: 'admin',
          teamId: team.id,
        },
      });

      // Create default labels for the team
      await tx.label.createMany({
        data: [
          { name: 'New', color: '#22c55e', teamId: team.id },
          { name: 'Follow Up', color: '#f59e0b', teamId: team.id },
          { name: 'VIP', color: '#8b5cf6', teamId: team.id },
          { name: 'Support', color: '#3b82f6', teamId: team.id },
          { name: 'Sales', color: '#ec4899', teamId: team.id },
        ],
      });

      return { team, user };
    });

    const token = generateToken({
      id: result.user.id,
      email: result.user.email,
      teamId: result.team.id,
      role: result.user.role,
    });

    return res.status(201).json({
      token,
      user: {
        id: result.user.id,
        email: result.user.email,
        name: result.user.name,
        role: result.user.role,
        avatar: result.user.avatar,
        status: result.user.status,
        teamId: result.team.id,
      },
      team: {
        id: result.team.id,
        name: result.team.name,
      },
    });
  } catch (err) {
    console.error('[Auth] Register error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/auth/login
router.post('/login', async (req: Request, res: Response) => {
  try {
    const parsed = loginSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        error: 'Validation failed',
        details: parsed.error.errors,
      });
    }

    const { email, password } = parsed.data;

    const user = await prisma.user.findUnique({
      where: { email },
      include: { team: true },
    });

    if (!user) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    const passwordMatch = await bcrypt.compare(password, user.password);
    if (!passwordMatch) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    // Update user status to online
    await prisma.user.update({
      where: { id: user.id },
      data: { status: 'online' },
    });

    const token = generateToken({
      id: user.id,
      email: user.email,
      teamId: user.teamId,
      role: user.role,
    });

    return res.json({
      token,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        avatar: user.avatar,
        status: 'online',
        teamId: user.teamId,
      },
      team: {
        id: user.team.id,
        name: user.team.name,
        waPhoneNumberId: user.team.waPhoneNumberId,
        waWebhookSecret: user.team.waWebhookSecret,
      },
    });
  } catch (err) {
    console.error('[Auth] Login error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/auth/me
router.get('/me', authenticate, async (req: Request, res: Response) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user!.id },
      include: { team: true },
    });

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    return res.json({
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        avatar: user.avatar,
        status: user.status,
        teamId: user.teamId,
        createdAt: user.createdAt,
      },
      team: {
        id: user.team.id,
        name: user.team.name,
        waPhoneNumberId: user.team.waPhoneNumberId,
        waWebhookSecret: user.team.waWebhookSecret,
      },
    });
  } catch (err) {
    console.error('[Auth] Get me error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// PATCH /api/auth/me
router.patch('/me', authenticate, async (req: Request, res: Response) => {
  try {
    const updateSchema = z.object({
      name: z.string().min(2).optional(),
      status: z.enum(['online', 'offline', 'busy']).optional(),
      avatar: z.string().url().nullable().optional(),
      currentPassword: z.string().optional(),
      newPassword: z.string().min(8).optional(),
    });

    const parsed = updateSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        error: 'Validation failed',
        details: parsed.error.errors,
      });
    }

    const { name, status, avatar, currentPassword, newPassword } = parsed.data;

    const updateData: Record<string, string | null | undefined> = {};

    if (name !== undefined) updateData.name = name;
    if (status !== undefined) updateData.status = status;
    if (avatar !== undefined) updateData.avatar = avatar;

    // Handle password change
    if (newPassword) {
      if (!currentPassword) {
        return res.status(400).json({ error: 'Current password required to set new password' });
      }

      const user = await prisma.user.findUnique({ where: { id: req.user!.id } });
      if (!user) return res.status(404).json({ error: 'User not found' });

      const passwordMatch = await bcrypt.compare(currentPassword, user.password);
      if (!passwordMatch) {
        return res.status(401).json({ error: 'Current password is incorrect' });
      }

      updateData.password = await bcrypt.hash(newPassword, 12);
    }

    const updatedUser = await prisma.user.update({
      where: { id: req.user!.id },
      data: updateData,
    });

    return res.json({
      user: {
        id: updatedUser.id,
        email: updatedUser.email,
        name: updatedUser.name,
        role: updatedUser.role,
        avatar: updatedUser.avatar,
        status: updatedUser.status,
        teamId: updatedUser.teamId,
      },
    });
  } catch (err) {
    console.error('[Auth] Update me error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/auth/logout
router.post('/logout', authenticate, async (req: Request, res: Response) => {
  try {
    // Update user status to offline
    await prisma.user.update({
      where: { id: req.user!.id },
      data: { status: 'offline' },
    });

    return res.json({ message: 'Logged out successfully' });
  } catch (err) {
    console.error('[Auth] Logout error:', err);
    // Still return success - logout is client-side primarily
    return res.json({ message: 'Logged out successfully' });
  }
});

export default router;
