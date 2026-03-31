/**
 * Reset demo user passwords in the production database.
 * Run this with the production DATABASE_URL set.
 *
 * Usage:
 *   cd backend
 *   npx prisma generate          # ensure client matches schema (postgresql)
 *   npx tsx prisma/reset-password.ts
 */

import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

const USERS_TO_RESET = [
  { email: 'admin@demo.com', password: 'demo1234' },
  { email: 'agent@demo.com', password: 'demo1234' },
];

async function main() {
  console.log('🔑 Resetting demo user passwords...');
  console.log(`   Database: ${process.env.DATABASE_URL?.replace(/:[^:@]+@/, ':****@')}`);

  for (const { email, password } of USERS_TO_RESET) {
    const user = await prisma.user.findUnique({ where: { email } });

    if (!user) {
      console.log(`  ❌ User not found: ${email}`);
      continue;
    }

    const hash = await bcrypt.hash(password, 12);
    await prisma.user.update({
      where: { id: user.id },
      data: { password: hash },
    });

    // Verify it works
    const ok = await bcrypt.compare(password, hash);
    console.log(`  ${ok ? '✅' : '❌'} ${email} — password reset ${ok ? 'OK' : 'FAILED'}`);
  }

  console.log('\nDone.');
}

main()
  .catch((e) => {
    console.error('Error:', e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
