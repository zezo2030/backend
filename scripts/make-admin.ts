import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const email = process.argv[2]?.trim().toLowerCase();
if (!email) {
  console.error('Usage: npm run make:admin -- <email>');
  process.exit(1);
}

async function main(): Promise<void> {
  const user = await prisma.user.findFirst({ where: { email, deletedAt: null } });
  if (!user) {
    console.error(`No active user found for ${email}`);
    process.exit(1);
  }

  await prisma.user.update({
    where: { id: user.id },
    data: { role: 'Admin', isVerified: true, isActive: true }
  });

  await prisma.auditEvent.create({
    data: {
      actorUserId: user.id,
      action: 'admin.user_promoted',
      targetType: 'user',
      targetId: user.id,
      metadata: { email }
    }
  });

  console.log(`Promoted ${email} to Admin`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
