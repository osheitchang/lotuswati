/**
 * One-time script to merge duplicate conversations for the same contact.
 *
 * Run with:
 *   cd backend && npx tsx scripts/merge-duplicate-conversations.ts
 *
 * What it does:
 *   1. Finds contacts that have more than one conversation in any status.
 *   2. Keeps the oldest conversation, moves all messages/notes/labels from
 *      duplicates into it, then deletes the duplicates.
 *   3. Prints a summary of what was merged.
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('Scanning for duplicate conversations…');

  // Find contactIds that have more than one conversation
  const grouped = await prisma.conversation.groupBy({
    by: ['contactId', 'teamId'],
    _count: { id: true },
    having: { id: { _count: { gt: 1 } } },
  });

  if (grouped.length === 0) {
    console.log('No duplicates found. Nothing to do.');
    return;
  }

  console.log(`Found ${grouped.length} contact(s) with duplicate conversations.\n`);

  let totalMerged = 0;

  for (const { contactId, teamId } of grouped) {
    const conversations = await prisma.conversation.findMany({
      where: { contactId, teamId },
      orderBy: { createdAt: 'asc' },
      include: { _count: { select: { messages: true } } },
    });

    // Keep the oldest; merge the rest into it
    const [primary, ...duplicates] = conversations;

    console.log(
      `Contact ${contactId}: keeping conversation ${primary.id} (${primary._count.messages} messages), ` +
      `merging ${duplicates.length} duplicate(s).`
    );

    for (const dup of duplicates) {
      await prisma.$transaction(async (tx) => {
        // Re-parent messages
        await tx.message.updateMany({
          where: { conversationId: dup.id },
          data: { conversationId: primary.id },
        });

        // Re-parent notes
        await tx.note.updateMany({
          where: { conversationId: dup.id },
          data: { conversationId: primary.id },
        });

        // Merge labels (upsert to avoid unique constraint errors)
        const dupLabels = await tx.conversationLabel.findMany({
          where: { conversationId: dup.id },
        });
        for (const cl of dupLabels) {
          await tx.conversationLabel.upsert({
            where: { conversationId_labelId: { conversationId: primary.id, labelId: cl.labelId } },
            create: { conversationId: primary.id, labelId: cl.labelId },
            update: {},
          });
        }
        await tx.conversationLabel.deleteMany({ where: { conversationId: dup.id } });

        // Delete the duplicate
        await tx.conversation.delete({ where: { id: dup.id } });
      });

      console.log(`  Merged and deleted duplicate ${dup.id}`);
      totalMerged++;
    }

    // Update primary's lastMessageAt to reflect merged messages
    const latest = await prisma.message.findFirst({
      where: { conversationId: primary.id },
      orderBy: { createdAt: 'desc' },
    });
    if (latest) {
      await prisma.conversation.update({
        where: { id: primary.id },
        data: { lastMessageAt: latest.createdAt },
      });
    }
  }

  console.log(`\nDone. Merged and deleted ${totalMerged} duplicate conversation(s).`);
}

main()
  .catch((err) => { console.error(err); process.exit(1); })
  .finally(() => prisma.$disconnect());
