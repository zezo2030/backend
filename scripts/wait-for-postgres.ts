import { PrismaClient } from '@prisma/client';

const url = process.env.DATABASE_URL;
if (!url) {
  console.error('DATABASE_URL is not set');
  process.exit(1);
}

const prisma = new PrismaClient({ datasourceUrl: url });
const maxAttempts = 60;
const delayMs = 1000;

async function wait(): Promise<void> {
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      await prisma.$queryRaw`SELECT 1`;
      console.log('PostgreSQL is ready');
      await prisma.$disconnect();
      return;
    } catch {
      if (attempt === maxAttempts) {
        console.error('PostgreSQL did not become ready in time');
        await prisma.$disconnect();
        process.exit(1);
      }
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
  }
}

void wait();
