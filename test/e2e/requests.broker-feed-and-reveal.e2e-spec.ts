import request from 'supertest';
import { adminSession } from '../helpers/admin-helpers.js';
import {
  closeAuthTestApp,
  createAuthTestApp,
  httpServer,
  issueSession,
  type AuthTestApp
} from '../helpers/auth-test-app.js';
import { makePropertyRequestPayload } from '../helpers/property-request-payload.js';

describe('property requests broker feed and contact reveal (e2e)', () => {
  let testApp: AuthTestApp;

  beforeAll(async () => {
    testApp = await createAuthTestApp();
  });

  afterAll(async () => {
    await closeAuthTestApp(testApp);
  });

  it('allows broker feed/reveal and forbids regular-user access', async () => {
    const owner = await roleSession('u5552000301@test.local', 'RegularUser');
    const broker = await roleSession('u5552000302@test.local', 'Broker');
    const regular = await roleSession('u5552000303@test.local', 'RegularUser');

    const created = await request(httpServer(testApp))
      .post('/api/v1/property-requests')
      .set('Authorization', `Bearer ${owner.accessToken}`)
      .send(await makePropertyRequestPayload(testApp.prisma))
      .expect(202);
    const createdBody = created.body as { id: string };

    // Requests are pending on creation; approve so it surfaces to brokers.
    const admin = await adminSession(testApp, 'u5552000300@test.local');
    await request(httpServer(testApp))
      .patch(`/api/v1/admin/property-requests/${createdBody.id}/status`)
      .set('Authorization', `Bearer ${admin.accessToken}`)
      .send({ moderationStatus: 'active' })
      .expect(200);

    await request(httpServer(testApp))
      .get('/api/v1/property-requests')
      .set('Authorization', `Bearer ${regular.accessToken}`)
      .expect(403);

    await request(httpServer(testApp))
      .get('/api/v1/property-requests')
      .set('Authorization', `Bearer ${broker.accessToken}`)
      .expect(200)
      .expect(({ body }) => {
        const feed = body as {
          items: Array<{ requester: { phone?: string; email?: string } }>;
        };
        expect(feed.items[0]?.requester.phone).toBeUndefined();
        expect(feed.items[0]?.requester.email).toBeUndefined();
      });

    await request(httpServer(testApp))
      .get(`/api/v1/property-requests/${createdBody.id}/contact`)
      .set('Authorization', `Bearer ${regular.accessToken}`)
      .expect(403);

    await request(httpServer(testApp))
      .get(`/api/v1/property-requests/${createdBody.id}/contact`)
      .set('Authorization', `Bearer ${broker.accessToken}`)
      .expect(200)
      .expect(({ body }) => {
        expect((body as { email: string }).email).toBe('u5552000301@test.local');
      });
    expect(
      await testApp.prisma.auditEvent.count({
        where: { action: 'request.contact_revealed' }
      })
    ).toBe(1);
  });

  async function roleSession(email: string, role: 'RegularUser' | 'Broker') {
    const first = await issueSession(testApp, email);
    await request(httpServer(testApp))
      .post('/api/v1/auth/select-role')
      .set('Authorization', `Bearer ${first.accessToken}`)
      .send({ role, officeName: `${role} Office` });
    return issueSession(testApp, email);
  }
});
