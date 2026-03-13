import { Router, Request, Response } from 'express';
import prisma from '../lib/prisma';
import { authenticate } from '../middleware/auth';

const router = Router();
router.use(authenticate);

// Helper: get start of day N days ago
function daysAgo(n: number): Date {
  const d = new Date();
  d.setDate(d.getDate() - n);
  d.setHours(0, 0, 0, 0);
  return d;
}

function startOfToday(): Date {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

function endOfToday(): Date {
  const d = new Date();
  d.setHours(23, 59, 59, 999);
  return d;
}

// GET /api/analytics/overview
router.get('/overview', async (req: Request, res: Response) => {
  try {
    const teamId = req.user!.teamId;
    const todayStart = startOfToday();
    const todayEnd = endOfToday();

    const [
      totalConversations,
      openConversations,
      pendingConversations,
      resolvedToday,
      totalContacts,
      messagesSentToday,
      messagesReceivedToday,
    ] = await Promise.all([
      prisma.conversation.count({ where: { teamId } }),
      prisma.conversation.count({ where: { teamId, status: 'open' } }),
      prisma.conversation.count({ where: { teamId, status: 'pending' } }),
      prisma.conversation.count({
        where: {
          teamId,
          status: 'resolved',
          updatedAt: { gte: todayStart, lte: todayEnd },
        },
      }),
      prisma.contact.count({ where: { teamId } }),
      prisma.message.count({
        where: {
          fromType: { in: ['agent', 'bot'] },
          createdAt: { gte: todayStart, lte: todayEnd },
          conversation: { teamId },
        },
      }),
      prisma.message.count({
        where: {
          fromType: 'contact',
          createdAt: { gte: todayStart, lte: todayEnd },
          conversation: { teamId },
        },
      }),
    ]);

    // Calculate average response time (in minutes)
    // We approximate this by looking at pairs of contact messages followed by agent messages
    const recentConversations = await prisma.conversation.findMany({
      where: { teamId, status: 'resolved', updatedAt: { gte: daysAgo(7) } },
      include: {
        messages: {
          orderBy: { createdAt: 'asc' },
          select: { fromType: true, createdAt: true },
        },
      },
      take: 50,
    });

    let totalResponseTimeMs = 0;
    let responseCount = 0;

    for (const conv of recentConversations) {
      const messages = conv.messages;
      for (let i = 0; i < messages.length - 1; i++) {
        if (
          messages[i].fromType === 'contact' &&
          messages[i + 1].fromType === 'agent'
        ) {
          const diff =
            messages[i + 1].createdAt.getTime() - messages[i].createdAt.getTime();
          if (diff > 0 && diff < 24 * 60 * 60 * 1000) {
            // Ignore > 24h
            totalResponseTimeMs += diff;
            responseCount++;
          }
        }
      }
    }

    const avgResponseTimeMinutes =
      responseCount > 0
        ? Math.round(totalResponseTimeMs / responseCount / 1000 / 60)
        : 0;

    return res.json({
      totalConversations,
      openConversations,
      pendingConversations,
      resolvedToday,
      totalContacts,
      messagesSentToday,
      messagesReceivedToday,
      avgResponseTimeMinutes,
    });
  } catch (err) {
    console.error('[Analytics] Overview error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/analytics/conversations
// Conversation volume by day for the last 30 days
router.get('/conversations', async (req: Request, res: Response) => {
  try {
    const teamId = req.user!.teamId;
    const thirtyDaysAgo = daysAgo(30);

    const conversations = await prisma.conversation.findMany({
      where: {
        teamId,
        createdAt: { gte: thirtyDaysAgo },
      },
      select: { createdAt: true, status: true },
    });

    // Group by day
    const dayMap: Record<string, { date: string; total: number; open: number; resolved: number }> =
      {};

    for (let i = 0; i < 30; i++) {
      const d = daysAgo(29 - i);
      const key = d.toISOString().split('T')[0];
      dayMap[key] = { date: key, total: 0, open: 0, resolved: 0 };
    }

    for (const conv of conversations) {
      const key = conv.createdAt.toISOString().split('T')[0];
      if (dayMap[key]) {
        dayMap[key].total++;
        if (conv.status === 'open') dayMap[key].open++;
        if (conv.status === 'resolved') dayMap[key].resolved++;
      }
    }

    return res.json({
      data: Object.values(dayMap),
    });
  } catch (err) {
    console.error('[Analytics] Conversations error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/analytics/agents
// Agent performance stats
router.get('/agents', async (req: Request, res: Response) => {
  try {
    const teamId = req.user!.teamId;
    const thirtyDaysAgo = daysAgo(30);

    const agents = await prisma.user.findMany({
      where: { teamId },
      select: { id: true, name: true, email: true, avatar: true, status: true },
    });

    const agentStats = await Promise.all(
      agents.map(async (agent) => {
        const [assigned, resolved, messageCount] = await Promise.all([
          prisma.conversation.count({
            where: {
              teamId,
              assignedToId: agent.id,
              status: { not: 'resolved' },
            },
          }),
          prisma.conversation.count({
            where: {
              teamId,
              assignedToId: agent.id,
              status: 'resolved',
              updatedAt: { gte: thirtyDaysAgo },
            },
          }),
          prisma.message.count({
            where: {
              fromId: agent.id,
              fromType: 'agent',
              createdAt: { gte: thirtyDaysAgo },
            },
          }),
        ]);

        // Calculate avg response time for this agent
        const agentConversations = await prisma.conversation.findMany({
          where: {
            teamId,
            assignedToId: agent.id,
            status: 'resolved',
            updatedAt: { gte: thirtyDaysAgo },
          },
          include: {
            messages: {
              orderBy: { createdAt: 'asc' },
              select: { fromType: true, fromId: true, createdAt: true },
            },
          },
          take: 20,
        });

        let totalMs = 0;
        let count = 0;

        for (const conv of agentConversations) {
          for (let i = 0; i < conv.messages.length - 1; i++) {
            if (
              conv.messages[i].fromType === 'contact' &&
              conv.messages[i + 1].fromType === 'agent' &&
              conv.messages[i + 1].fromId === agent.id
            ) {
              const diff =
                conv.messages[i + 1].createdAt.getTime() -
                conv.messages[i].createdAt.getTime();
              if (diff > 0 && diff < 24 * 60 * 60 * 1000) {
                totalMs += diff;
                count++;
              }
            }
          }
        }

        const avgResponseTimeMinutes =
          count > 0 ? Math.round(totalMs / count / 1000 / 60) : 0;

        return {
          agent,
          stats: {
            assignedConversations: assigned,
            resolvedLast30Days: resolved,
            messagesSent: messageCount,
            avgResponseTimeMinutes,
          },
        };
      })
    );

    return res.json({ agents: agentStats });
  } catch (err) {
    console.error('[Analytics] Agents error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/analytics/labels
// Label distribution
router.get('/labels', async (req: Request, res: Response) => {
  try {
    const teamId = req.user!.teamId;

    const labels = await prisma.label.findMany({
      where: { teamId },
      include: {
        _count: { select: { conversations: true } },
      },
    });

    const totalLabeled = labels.reduce((sum, l) => sum + l._count.conversations, 0);

    return res.json({
      labels: labels.map((l) => ({
        id: l.id,
        name: l.name,
        color: l.color,
        count: l._count.conversations,
        percentage:
          totalLabeled > 0
            ? Math.round((l._count.conversations / totalLabeled) * 100)
            : 0,
      })),
      total: totalLabeled,
    });
  } catch (err) {
    console.error('[Analytics] Labels error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/analytics/response-times
// Response time trends over the last 14 days
router.get('/response-times', async (req: Request, res: Response) => {
  try {
    const teamId = req.user!.teamId;
    const fourteenDaysAgo = daysAgo(14);

    const conversations = await prisma.conversation.findMany({
      where: {
        teamId,
        status: 'resolved',
        updatedAt: { gte: fourteenDaysAgo },
      },
      include: {
        messages: {
          orderBy: { createdAt: 'asc' },
          select: { fromType: true, createdAt: true },
        },
      },
    });

    // Group average response times by day
    const dayMap: Record<
      string,
      { date: string; avgMinutes: number; totalMs: number; count: number }
    > = {};

    for (let i = 0; i < 14; i++) {
      const d = daysAgo(13 - i);
      const key = d.toISOString().split('T')[0];
      dayMap[key] = { date: key, avgMinutes: 0, totalMs: 0, count: 0 };
    }

    for (const conv of conversations) {
      const dayKey = conv.updatedAt.toISOString().split('T')[0];
      if (!dayMap[dayKey]) continue;

      for (let i = 0; i < conv.messages.length - 1; i++) {
        if (
          conv.messages[i].fromType === 'contact' &&
          conv.messages[i + 1].fromType === 'agent'
        ) {
          const diff =
            conv.messages[i + 1].createdAt.getTime() -
            conv.messages[i].createdAt.getTime();
          if (diff > 0 && diff < 24 * 60 * 60 * 1000) {
            dayMap[dayKey].totalMs += diff;
            dayMap[dayKey].count++;
          }
        }
      }
    }

    // Compute averages
    for (const key of Object.keys(dayMap)) {
      if (dayMap[key].count > 0) {
        dayMap[key].avgMinutes = Math.round(
          dayMap[key].totalMs / dayMap[key].count / 1000 / 60
        );
      }
    }

    return res.json({
      data: Object.values(dayMap).map(({ date, avgMinutes, count }) => ({
        date,
        avgResponseTimeMinutes: avgMinutes,
        sampleSize: count,
      })),
    });
  } catch (err) {
    console.error('[Analytics] Response times error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
