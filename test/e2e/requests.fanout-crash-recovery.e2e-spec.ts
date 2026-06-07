import request from 'supertest';
import { FanoutOutboxStatus } from '../../src/modules/fanout/fanout.enums.js';
import { FanoutReaper } from '../../src/modules/fanout/fanout.reaper.js';
import { FanoutWorker } from '../../src/modules/fanout/fanout.worker.js';
import {
  closeAuthTestApp,
  createAuthTestApp,
  httpServer,
  issueSession,
  type AuthTestApp
} from '../helpers/auth-test-app.js';
import { makePropertyRequestPayload } from '../helpers/property-request-payload.js';

describe('property requests fanout crash recovery (e2e)', () => {
  let testApp: AuthTestApp;

  beforeAll(async () => {
    testApp = await createAuthTestApp();
  });

  afterAll(async () => {
    await closeAuthTestApp(testApp);
  });

  it('reclaims expired leases and finishes fanout after restart', async () => {
    const requester = await roleSession('u5552000201@test.local', 'RegularUser');
    await roleSession('u5552000202@test.local', 'Broker');

    const payload = await makePropertyRequestPayload(testApp.prisma);
    const created = await request(httpServer(testApp))
      .post('/api/v1/property-requests')
      .set('Authorization', `Bearer ${requester.accessToken}`)
      .send(payload)
      .expect(202);
    const requestId = (created.body as { id: string }).id;

    await testApp.prisma.fanoutOutbox.update({
      where: { requestId },
      data: {
        status: FanoutOutboxStatus.in_progress,
        leasedBy: 'crashed-worker',
        leasedUntil: new Date(Date.now() - 1000)
      }
    });
    await expect(testApp.app.get(FanoutReaper).reapExpiredLeases()).resolves.toBe(1);
    await expect(testApp.app.get(FanoutWorker).drainOnce()).resolves.toBe(true);
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
