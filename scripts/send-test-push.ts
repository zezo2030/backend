import { config } from 'dotenv';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

config();
import { PrismaClient, NotificationType } from '@prisma/client';
import { cert, getApps, initializeApp } from 'firebase-admin/app';
import { getMessaging } from 'firebase-admin/messaging';

const prisma = new PrismaClient();

const email = process.argv[2]?.trim().toLowerCase();
if (!email) {
  console.error('Usage: npm run push:test -- <email>');
  process.exit(1);
}

function initFirebase(): void {
  if (getApps().length > 0) return;
  const path = process.env.FIREBASE_SERVICE_ACCOUNT_PATH?.trim();
  if (!path) {
    console.error('FIREBASE_SERVICE_ACCOUNT_PATH is not set');
    process.exit(1);
  }
  const parsed = JSON.parse(readFileSync(resolve(path), 'utf8')) as Record<string, string>;
  initializeApp({
    credential: cert({
      projectId: parsed.project_id ?? parsed.projectId ?? '',
      clientEmail: parsed.client_email ?? parsed.clientEmail ?? '',
      privateKey: (parsed.private_key ?? parsed.privateKey ?? '').replace(/\\n/g, '\n')
    })
  });
}

async function main(): Promise<void> {
  const user = await prisma.user.findFirst({
    where: { email, deletedAt: null },
    select: { id: true, email: true, role: true, isActive: true }
  });
  if (!user) {
    console.error(`No active user for ${email}`);
    process.exit(1);
  }
  if (!user.isActive) {
    console.error(`User ${email} is inactive`);
    process.exit(1);
  }

  const tokens = await prisma.deviceToken.findMany({
    where: { userId: user.id, isActive: true },
    select: { token: true, deviceType: true }
  });
  if (tokens.length === 0) {
    console.error(`No active device tokens for ${email}. Open the mobile app, sign in, and allow notifications.`);
    process.exit(1);
  }

  initFirebase();
  const messaging = getMessaging();
  const ANDROID_CHANNEL_ID = 'requests';
  const title = 'اختبار Firebase';
  const body = 'إشعار تجريبي من الـ backend — إذا وصلتك الرسالة فـ FCM شغال ✅';
  const notification = await prisma.notification.create({
    data: {
      recipientUserId: user.id,
      type: NotificationType.admin_broadcast,
      title,
      body,
      data: { test: true, source: 'send-test-push' },
      sourceRequestId: null
    }
  });

  const response = await messaging.sendEach(
    tokens.map(({ token }) => ({
      token,
      notification: { title, body },
      data: {
        type: NotificationType.admin_broadcast,
        title,
        body,
        targetKind: 'user',
        targetId: user.id,
        notificationId: notification.id
      },
      android: {
        priority: 'high' as const,
        ttl: 86400000,
        notification: {
          channelId: ANDROID_CHANNEL_ID,
          priority: 'high' as const,
          visibility: 'public' as const,
          defaultSound: true,
          defaultVibrateTimings: true
        }
      },
      apns: {
        headers: { 'apns-priority': '10' },
        payload: {
          aps: {
            alert: { title, body },
            sound: 'default',
            contentAvailable: true
          }
        }
      }
    }))
  );

  response.responses.forEach((item, index) => {
    const token = tokens[index]?.token ?? '';
    const preview = `${token.slice(0, 12)}…`;
    if (item.success) {
      console.log(`OK  ${preview} messageId=${item.messageId}`);
    } else {
      console.error(`FAIL ${preview} ${item.error?.code}: ${item.error?.message}`);
    }
  });

  const ok = response.successCount;
  const fail = response.failureCount;
  console.log(`\nSent to ${email} (${user.role}): ${ok} ok, ${fail} failed, notificationId=${notification.id}`);
  if (fail > 0) process.exit(1);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
