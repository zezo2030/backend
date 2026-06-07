import request from 'supertest';
import { NotificationType } from '@prisma/client';
import { BroadcastWorker } from '../../src/modules/admin/broadcast.worker.js';
import { adminSession, sessionWithRole } from '../helpers/admin-helpers.js';
import {
  closeAuthTestApp,
  createAuthTestApp,
  httpServer,
  type AuthTestApp
} from '../helpers/auth-test-app.js';

describe('admin broadcast (e2e)', () => {
  let testApp: AuthTestApp;

  beforeAll(async () => {
    testApp = await createAuthTestApp();
  });

  afterAll(async () => {
    await closeAuthTestApp(testApp);
  });

  async function seedToken(userId: string, token: string): Promise<void> {
    await testApp.prisma.deviceToken.create({
      data: { userId, token, deviceType: 'ios', isActive: true, lastSeenAt: new Date() }
    });
  }

  it('targets brokers only — one notification per active broker, no regular users', async () => {
    const admin = await adminSession(testApp, 'u5553200001@test.local');
    const broker1 = await sessionWithRole(testApp, 'u5553200002@test.local', 'Broker');
    const broker2 = await sessionWithRole(testApp, 'u5553200003@test.local', 'Broker');
    const regular = await sessionWithRole(testApp, 'u5553200005@test.local', 'RegularUser');
    await seedToken(broker1.user.id, 'tok-b1');
    await seedToken(broker2.user.id, 'tok-b2');
    await seedToken(regular.user.id, 'tok-r');

    await request(httpServer(testApp))
      .post('/api/v1/admin/notifications/broadcast')
      .set('Authorization', `Bearer ${admin.accessToken}`)
      .send({ audience: 'brokers', title: 'Hello brokers', body: 'Update' })
      .expect(202);

    await testApp.app.get(BroadcastWorker).drainOnce();

    const brokerNotifs = await testApp.prisma.notification.count({
      where: { type: NotificationType.admin_broadcast, recipientUserId: broker1.user.id }
    });
    const broker2Notifs = await testApp.prisma.notification.count({
      where: { type: NotificationType.admin_broadcast, recipientUserId: broker2.user.id }
    });
    const regularNotifs = await testApp.prisma.notification.count({
      where: { type: NotificationType.admin_broadcast, recipientUserId: regular.user.id }
    });

    expect(brokerNotifs).toBe(1);
    expect(broker2Notifs).toBe(1);
    expect(regularNotifs).toBe(0);
  });
});
