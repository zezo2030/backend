import { NotificationType, Role } from '@prisma/client';
import { NotificationsService } from '../../src/modules/notifications/notifications.service.js';
import { closeAuthTestApp, createAuthTestApp, type AuthTestApp } from '../helpers/auth-test-app.js';

describe('NotificationsService (integration)', () => {
  let testApp: AuthTestApp;
  let notifications: NotificationsService;
  let userId: string;
  let otherUserId: string;

  beforeAll(async () => {
    testApp = await createAuthTestApp();
    notifications = testApp.app.get(NotificationsService);
    userId = (
      await testApp.prisma.user.create({
        data: { email: 'notif-user@test.local', displayName: 'Notif User', role: Role.RegularUser }
      })
    ).id;
    otherUserId = (
      await testApp.prisma.user.create({
        data: { email: 'notif-other@test.local', displayName: 'Other User', role: Role.RegularUser }
      })
    ).id;

    const baseInstant = Date.parse('2026-05-26T00:00:00.000Z');
    await testApp.prisma.notification.createMany({
      data: [
        {
          recipientUserId: userId,
          type: NotificationType.admin_broadcast,
          title: 'Older',
          body: 'older body',
          createdAt: new Date(baseInstant),
          updatedAt: new Date(baseInstant)
        },
        {
          recipientUserId: userId,
          type: NotificationType.admin_broadcast,
          title: 'Newer',
          body: 'newer body',
          createdAt: new Date(baseInstant + 1000),
          updatedAt: new Date(baseInstant + 1000)
        },
        {
          recipientUserId: userId,
          type: NotificationType.admin_broadcast,
          title: 'AlreadyRead',
          body: 'read body',
          readAt: new Date(baseInstant + 500),
          createdAt: new Date(baseInstant + 2000),
          updatedAt: new Date(baseInstant + 2000)
        },
        {
          recipientUserId: otherUserId,
          type: NotificationType.admin_broadcast,
          title: 'Other',
          body: 'other body',
          createdAt: new Date(baseInstant + 3000),
          updatedAt: new Date(baseInstant + 3000)
        }
      ]
    });
  });

  afterAll(async () => {
    await closeAuthTestApp(testApp);
  });

  it('lists inbox sorted newest first and scoped to the user', async () => {
    const page = await notifications.list(userId, 1, 10, false);
    expect(page.items.map((item) => item.title)).toEqual(['AlreadyRead', 'Newer', 'Older']);
    expect(page.pageInfo.totalItems).toBe(3);
  });

  it('filters to unread only when unreadOnly is true', async () => {
    const page = await notifications.list(userId, 1, 10, true);
    expect(page.items.map((item) => item.title)).toEqual(['Newer', 'Older']);
    expect(page.items.every((item) => item.readAt === null)).toBe(true);
  });

  it('marks a notification as read and is idempotent on the second call', async () => {
    const inbox = await notifications.list(userId, 1, 10, true);
    const target = inbox.items[0]!;

    await notifications.markRead(userId, target.id);
    await notifications.markRead(userId, target.id);

    const persisted = await testApp.prisma.notification.findUnique({
      where: { id: target.id }
    });
    expect(persisted?.readAt).toBeInstanceOf(Date);
  });
});
