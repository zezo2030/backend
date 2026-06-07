import { NotificationType, Role } from '@prisma/client';
import request from 'supertest';
import {
  closeAuthTestApp,
  createAuthTestApp,
  httpServer,
  issueSession,
  type AuthTestApp
} from '../helpers/auth-test-app.js';

interface NotificationBody {
  id: string;
  title: string;
  readAt: string | null;
}

interface InboxPageBody {
  items: NotificationBody[];
  pageInfo: {
    page: number;
    pageSize: number;
    totalItems: number;
    totalPages: number;
  };
}

describe('notifications inbox (e2e)', () => {
  let testApp: AuthTestApp;
  let token: string;
  let userId: string;

  beforeAll(async () => {
    testApp = await createAuthTestApp();
    const session = await sessionWithRole('u5554000001@test.local', 'RegularUser');
    token = session.accessToken;
    userId = session.user.id;

    const otherUser = await testApp.prisma.user.create({
      data: {
        email: 'notif-inbox-other@test.local',
        displayName: 'Other',
        role: Role.RegularUser
      }
    });
    const baseInstant = Date.parse('2026-05-26T10:00:00.000Z');
    await testApp.prisma.notification.createMany({
      data: [
        buildNotification(userId, 'First', null, new Date(baseInstant)),
        buildNotification(userId, 'Second', null, new Date(baseInstant + 1000)),
        buildNotification(
          userId,
          'Third',
          new Date(baseInstant + 500),
          new Date(baseInstant + 2000)
        ),
        buildNotification(
          otherUser.id,
          'OtherUserNotification',
          null,
          new Date(baseInstant + 3000)
        )
      ]
    });
  });

  afterAll(async () => {
    await closeAuthTestApp(testApp);
  });

  it('paginates inbox and supports unreadOnly filter', async () => {
    const firstPage = await request(httpServer(testApp))
      .get('/api/v1/notifications')
      .query({ page: 1, pageSize: 2 })
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    const firstPageBody = firstPage.body as InboxPageBody;
    expect(firstPageBody.items.map((notification) => notification.title)).toEqual([
      'Third',
      'Second'
    ]);
    expect(firstPageBody.pageInfo).toMatchObject({
      page: 1,
      pageSize: 2,
      totalItems: 3,
      totalPages: 2
    });
    expect(
      firstPageBody.items.find((notification) => notification.title === 'OtherUserNotification')
    ).toBeUndefined();

    const unread = await request(httpServer(testApp))
      .get('/api/v1/notifications')
      .query({ unreadOnly: true })
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    const unreadBody = unread.body as InboxPageBody;
    expect(unreadBody.items.map((notification) => notification.title)).toEqual(['Second', 'First']);
  });

  it('marks a notification as read (idempotent)', async () => {
    const inbox = await request(httpServer(testApp))
      .get('/api/v1/notifications')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    const target = (inbox.body as InboxPageBody).items.find(
      (notification) => notification.title === 'First'
    );
    expect(target).toBeDefined();

    await request(httpServer(testApp))
      .post(`/api/v1/notifications/${target!.id}/read`)
      .set('Authorization', `Bearer ${token}`)
      .expect(204);

    await request(httpServer(testApp))
      .post(`/api/v1/notifications/${target!.id}/read`)
      .set('Authorization', `Bearer ${token}`)
      .expect(204);

    const persisted = await testApp.prisma.notification.findUnique({
      where: { id: target!.id }
    });
    expect(persisted?.readAt).toBeInstanceOf(Date);
  });

  it('rejects unauthenticated access', async () => {
    await request(httpServer(testApp)).get('/api/v1/notifications').expect(401);
  });

  async function sessionWithRole(email: string, role: 'RegularUser' | 'Broker') {
    const first = await issueSession(testApp, email);
    await request(httpServer(testApp))
      .post('/api/v1/auth/select-role')
      .set('Authorization', `Bearer ${first.accessToken}`)
      .send({ role, officeName: `${role} Office` });
    return issueSession(testApp, email);
  }

  function buildNotification(
    recipientUserId: string,
    title: string,
    readAt: Date | null,
    createdAt: Date
  ) {
    return {
      recipientUserId,
      type: NotificationType.admin_broadcast,
      title,
      body: `${title} body`,
      readAt,
      createdAt,
      updatedAt: createdAt
    };
  }
});
