import request from 'supertest';
import { FanoutOutboxStatus } from '../../src/modules/fanout/fanout.enums.js';
import { FanoutWorker } from '../../src/modules/fanout/fanout.worker.js';
import { adminSession } from '../helpers/admin-helpers.js';
import {
  closeAuthTestApp,
  createAuthTestApp,
  httpServer,
  issueSession,
  type AuthTestApp
} from '../helpers/auth-test-app.js';
import { makePropertyRequestPayload } from '../helpers/property-request-payload.js';

describe('property requests fanout idempotency (e2e)', () => {
  let testApp: AuthTestApp;

  beforeAll(async () => {
    testApp = await createAuthTestApp();
  });

  afterAll(async () => {
    await closeAuthTestApp(testApp);
  });

  it('does not duplicate notifications when the same outbox row is retried', async () => {
    const requester = await roleSession('u5552000101@test.local', 'RegularUser');
    await roleSession('u5552000102@test.local', 'Broker');

    const payload = await makePropertyRequestPayload(testApp.prisma);
    const created = await request(httpServer(testApp))
      .post('/api/v1/property-requests')
      .set('Authorization', `Bearer ${requester.accessToken}`)
      .send(payload)
      .expect(202);
    const requestId = (created.body as { id: string }).id;
    const worker = testApp.app.get(FanoutWorker);

    // Approval enqueues the fanout outbox row.
    const admin = await adminSession(testApp, 'u5552000100@test.local');
    await request(httpServer(testApp))
      .patch(`/api/v1/admin/property-requests/${requestId}/status`)
      .set('Authorization', `Bearer ${admin.accessToken}`)
      .send({ moderationStatus: 'active' })
      .expect(200);

    await worker.drainOnce();
    await testApp.prisma.fanoutOutbox.update({
      where: { requestId },
      data: {
        status: FanoutOutboxStatus.pending,
        leasedBy: null,
        leasedUntil: null,
        processedCount: 0
      }
    });
    await worker.drainOnce();

    expect(
      await testApp.prisma.notification.count({
        where: { sourceRequestId: requestId }
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
