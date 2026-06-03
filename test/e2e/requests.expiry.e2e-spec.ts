import request from 'supertest';
import {
  closeAuthTestApp,
  createAuthTestApp,
  httpServer,
  issueSession,
  type AuthTestApp
} from '../helpers/auth-test-app.js';
import { makePropertyRequestPayload } from '../helpers/property-request-payload.js';

describe('property requests expiry (e2e)', () => {
  let testApp: AuthTestApp;

  beforeAll(async () => {
    testApp = await createAuthTestApp();
  });

  afterAll(async () => {
    await closeAuthTestApp(testApp);
  });

  it('excludes expired requests from broker feed but keeps them visible to owner', async () => {
    const owner = await roleSession('u5552000401@test.local', 'RegularUser');
    const broker = await roleSession('u5552000402@test.local', 'Broker');

    const created = await request(httpServer(testApp))
      .post('/api/v1/property-requests')
      .set('Authorization', `Bearer ${owner.accessToken}`)
      .send(makePropertyRequestPayload({ expiresAt: new Date(Date.now() - 1000).toISOString() }))
      .expect(202);
    const createdId = (created.body as { id: string }).id;

    await request(httpServer(testApp))
      .get('/api/v1/property-requests')
      .set('Authorization', `Bearer ${broker.accessToken}`)
      .expect(200)
      .expect(({ body }) => {
        expect((body as { items: unknown[] }).items).toHaveLength(0);
      });

    await request(httpServer(testApp))
      .get(`/api/v1/property-requests/${createdId}`)
      .set('Authorization', `Bearer ${owner.accessToken}`)
      .expect(200)
      .expect(({ body }) => {
        expect((body as { id: string }).id).toBe(createdId);
      });
  });

  async function roleSession(email: string, role: 'RegularUser' | 'Broker' | 'Agency') {
    const first = await issueSession(testApp, email);
    await request(httpServer(testApp))
      .post('/api/v1/auth/select-role')
      .set('Authorization', `Bearer ${first.accessToken}`)
      .send({ role, officeName: `${role} Office` });
    return issueSession(testApp, email);
  }
});
