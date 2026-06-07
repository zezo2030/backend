import { config } from 'dotenv';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

config({ path: resolve(process.cwd(), '.env') });

import {
  NotificationType,
  PrismaClient,
  type BroadcastAudience,
  type Role,
} from '@prisma/client';
import { cert, getApps, initializeApp } from 'firebase-admin/app';
import { getMessaging } from 'firebase-admin/messaging';

const prisma = new PrismaClient();

const audienceArg = (process.argv[2]?.trim().toLowerCase() ?? 'all') as BroadcastAudience;
const title = process.argv[3]?.trim() ?? 'اختبار إشعار عام';
const body =
  process.argv[4]?.trim() ??
  'هذا إشعار تجريبي من الـ backend — إذا وصلتك الرسالة فـ FCM شغال ✅';

const VALID_AUDIENCES = new Set<string>(['all', 'regular_users', 'brokers']);
const ANDROID_CHANNEL_ID = 'requests';

const AUDIENCE_ROLE_FILTER: Record<BroadcastAudience, Role[] | null> = {
  all: null,
  regular_users: ['RegularUser'],
  brokers: ['Broker'],
};

function initFirebase(): void {
  if (getApps().length > 0) return;
  const path = process.env.FIREBASE_SERVICE_ACCOUNT_PATH?.trim();
  if (!path) {
    throw new Error('FIREBASE_SERVICE_ACCOUNT_PATH is not set');
  }
  const parsed = JSON.parse(readFileSync(resolve(path), 'utf8')) as Record<string, string>;
  initializeApp({
    credential: cert({
      projectId: parsed.project_id ?? parsed.projectId ?? '',
      clientEmail: parsed.client_email ?? parsed.clientEmail ?? '',
      privateKey: (parsed.private_key ?? parsed.privateKey ?? '').replace(/\\n/g, '\n'),
    }),
  });
}

async function main(): Promise<void> {
  if (!VALID_AUDIENCES.has(audienceArg)) {
    console.error(
      'Usage: npm run broadcast:send -- [all|regular_users|brokers] [title] [body]',
    );
    process.exit(1);
  }

  const admin = await prisma.user.findFirst({
    where: { role: 'Admin', deletedAt: null, isActive: true },
    select: { id: true, email: true },
  });
  if (!admin) {
    console.error('No active Admin user found. Run: npm run make:admin -- <email>');
    process.exit(1);
  }

  const roleFilter = AUDIENCE_ROLE_FILTER[audienceArg];
  const recipients = await prisma.user.findMany({
    where: {
      isActive: true,
      deletedAt: null,
      role: roleFilter ? { in: roleFilter } : { not: null },
    },
    select: { id: true, email: true, phone: true, role: true },
  });
  const recipientIds = recipients.map((user) => user.id);

  const outbox = await prisma.broadcastOutbox.create({
    data: {
      actorUserId: admin.id,
      audience: audienceArg,
      title,
      body,
      status: 'in_progress',
      recipientCount: recipientIds.length,
      processedCount: 0,
    },
  });

  console.log(`Broadcast ${outbox.id} → audience=${audienceArg}, recipients=${recipientIds.length}`);

  if (recipientIds.length === 0) {
    await prisma.broadcastOutbox.update({
      where: { id: outbox.id },
      data: { status: 'done', processedCount: 0 },
    });
    console.log('No recipients matched this audience.');
    return;
  }

  const created = await prisma.notification.createMany({
    data: recipientIds.map((recipientUserId) => ({
      recipientUserId,
      type: NotificationType.admin_broadcast,
      title,
      body,
      sourceRequestId: null,
    })),
    skipDuplicates: true,
  });

  const notifications = await prisma.notification.findMany({
    where: {
      recipientUserId: { in: recipientIds },
      type: NotificationType.admin_broadcast,
      title,
      body,
    },
    select: { id: true, recipientUserId: true, title: true, body: true },
    orderBy: { createdAt: 'desc' },
  });
  const notificationByUser = new Map<string, (typeof notifications)[number]>();
  for (const row of notifications) {
    if (!notificationByUser.has(row.recipientUserId)) {
      notificationByUser.set(row.recipientUserId, row);
    }
  }

  const tokens = await prisma.deviceToken.findMany({
    where: { userId: { in: recipientIds }, isActive: true },
    select: { token: true, userId: true, deviceType: true },
  });

  let pushOk = 0;
  let pushFail = 0;

  if (tokens.length > 0 && process.env.PUSH_PROVIDER === 'fcm') {
    initFirebase();
    const messaging = getMessaging();
    const response = await messaging.sendEach(
      tokens.map(({ token, userId }) => {
        const notification = notificationByUser.get(userId);
        const pushBody = (notification?.body ?? body).slice(0, 500);
        return {
          token,
          notification: { title, body: pushBody },
          data: {
            type: NotificationType.admin_broadcast,
            title,
            body: pushBody,
            targetKind: 'user',
            targetId: userId,
            notificationId: notification?.id ?? '',
          },
          android: {
            priority: 'high' as const,
            ttl: 86400000,
            notification: {
              channelId: ANDROID_CHANNEL_ID,
              priority: 'high' as const,
              visibility: 'public' as const,
              defaultSound: true,
              defaultVibrateTimings: true,
            },
          },
          apns: {
            headers: { 'apns-priority': '10' },
            payload: {
              aps: {
                alert: { title, body: pushBody },
                sound: 'default',
                contentAvailable: true,
              },
            },
          },
        };
      }),
    );
    pushOk = response.successCount;
    pushFail = response.failureCount;
    response.responses.forEach((item, index) => {
      if (!item.success) {
        const preview = `${tokens[index]?.token.slice(0, 12) ?? ''}…`;
        console.error(`FCM FAIL ${preview} ${item.error?.code}: ${item.error?.message}`);
      }
    });
  }

  await prisma.broadcastOutbox.update({
    where: { id: outbox.id },
    data: {
      status: 'done',
      processedCount: created.count,
      recipientCount: recipientIds.length,
    },
  });

  console.log('\nRecipients:');
  for (const user of recipients) {
    const label = user.email ?? user.phone ?? user.id;
    console.log(`  - ${label} (${user.role})`);
  }
  console.log(`\nIn-app notifications created: ${created.count}`);
  console.log(`FCM pushes: ${pushOk} ok, ${pushFail} failed (${tokens.length} tokens)`);
  if (tokens.length === 0) {
    console.log(
      'No device tokens registered — users will see the message in the in-app inbox only.',
    );
  }
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
