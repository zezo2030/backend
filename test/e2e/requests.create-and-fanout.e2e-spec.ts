import request from 'supertest';
import { FanoutWorker } from '../../src/modules/fanout/fanout.worker.js';
import {
  closeAuthTestApp,
  createAuthTestApp,
  httpServer,
  issueSession,
  type AuthTestApp
} from '../helpers/auth-test-app.js';
import { makePropertyRequestPayload } from '../helpers/property-request-payload.js';

describe('property requests create and fanout (e2e)', () => {
  let testApp: AuthTestApp;

  beforeAll(async () => {
    testApp = await createAuthTestApp();
  });

  afterAll(async () => {
    await closeAuthTestApp(testApp);
  });

  it('returns 202 quickly, writes outbox, and fanout creates recipient notifications', async () => {
    const requester = await sessionWithRole('u5552000001@test.local', 'RegularUser');
    const broker = await sessionWithRole('u5552000002@test.local', 'Broker');
    await seedToken(broker.user.id, 'broker-token');

    const startedAt = Date.now();
    const payload = await makePropertyRequestPayload(testApp.prisma);
    const response = await request(httpServer(testApp))
      .post('/api/v1/property-requests')
      .set('Authorization', `Bearer ${requester.accessToken}`)
      .send(payload)
      .expect(202);

    expect(Date.now() - startedAt).toBeLessThan(1000);
    const requestId = (response.body as { id: string }).id;
    expect(
      await testApp.prisma.fanoutOutbox.count({
        where: { requestId }
      })
    ).toBe(1);

    await testApp.app.get(FanoutWorker).drainOnce();
    expect(
      await testApp.prisma.notification.count({
        where: { sourceRequestId: requestId }
      })
    ).toBe(1);
  });

  async function sessionWithRole(email: string, role: 'RegularUser' | 'Broker') {
    const first = await issueSession(testApp, email);
    await request(httpServer(testApp))
      .post('/api/v1/auth/select-role')
      .set('Authorization', `Bearer ${first.accessToken}`)
      .send({ role, officeName: `${role} Office` });
    return issueSession(testApp, email);
  }

  async function seedToken(userId: string, token: string): Promise<void> {
    await testApp.prisma.deviceToken.create({
      data: { userId, token, deviceType: 'ios', isActive: true, lastSeenAt: new Date() }
    });
  }
});
