import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcrypt';
import { randomBytes } from 'crypto';

const prisma = new PrismaClient();

const OWNER_EMAIL = (process.env.OWNER_EMAIL ?? 'mhd7190@gmail.com').trim().toLowerCase();
const LEGACY_ADMIN_EMAIL = 'admin@example.com';
const passwordArg = process.argv[2]?.trim();

async function softDeleteUser(userId: string): Promise<void> {
  await prisma.$transaction([
    prisma.user.update({
      where: { id: userId },
      data: {
        deletedAt: new Date(),
        tokenVersion: { increment: 1 },
        role: 'RegularUser',
        isOwner: false,
      },
    }),
    prisma.refreshToken.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt: new Date() },
    }),
  ]);
}

async function main(): Promise<void> {
  const password = passwordArg ?? randomBytes(12).toString('base64url');
  const passwordHash = await bcrypt.hash(password, 10);

  let owner = await prisma.user.findFirst({
    where: { email: OWNER_EMAIL, deletedAt: null },
  });

  if (owner) {
    owner = await prisma.user.update({
      where: { id: owner.id },
      data: {
        role: 'Admin',
        isOwner: true,
        isActive: true,
        isVerified: true,
        ...(!owner.passwordHash ? { passwordHash } : {}),
      },
    });
    console.log(`Updated existing owner account: ${OWNER_EMAIL}`);
  } else {
    owner = await prisma.user.create({
      data: {
        email: OWNER_EMAIL,
        displayName: 'Admin',
        passwordHash,
        role: 'Admin',
        isOwner: true,
        isActive: true,
        isVerified: true,
        tokenVersion: 0,
      },
    });
    console.log(`Created owner account: ${OWNER_EMAIL}`);
    console.log(`Temporary password: ${password}`);
  }

  await prisma.user.updateMany({
    where: { isOwner: true, id: { not: owner.id } },
    data: { isOwner: false },
  });

  const legacy = await prisma.user.findFirst({
    where: { email: LEGACY_ADMIN_EMAIL, deletedAt: null },
  });

  if (legacy) {
    await softDeleteUser(legacy.id);
    console.log(`Removed legacy admin: ${LEGACY_ADMIN_EMAIL}`);
  } else {
    console.log(`No legacy admin found (${LEGACY_ADMIN_EMAIL})`);
  }

  await prisma.auditEvent.create({
    data: {
      actorUserId: owner.id,
      action: 'admin.owner_bootstrapped',
      targetType: 'user',
      targetId: owner.id,
      metadata: { email: OWNER_EMAIL, legacyRemoved: LEGACY_ADMIN_EMAIL },
    },
  });
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
