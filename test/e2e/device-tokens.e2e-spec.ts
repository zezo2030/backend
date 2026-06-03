import request from 'supertest';
import { FanoutWorker } from '../../src/modules/fanout/fanout.worker.js';
import { PUSH_DISPATCHER, type PushDispatcher } from '../../src/infra/push/push.provider.js';
import {
  closeAuthTestApp,
  createAuthTestApp,
  httpServer,
  issueSession,
  type AuthTestApp
} from '../helpers/auth-test-app.js';
import { makePropertyRequestPayload } from '../helpers/property-request-payload.js';

interface StubAdapter extends PushDispatcher {
  dispatchLog: Array<{ tokens: string[]; message: { title: string; body: string } }>;
}

describe('device tokens (e2e)', () => {
  let testApp: AuthTestApp;

  beforeAll(async () => {
    testApp = await createAuthTestApp();
  });

  afterAll(async () => {
    await closeAuthTestApp(testApp);
  });

  it('registers two tokens and a push reaches both', async () => {
    const broker = await sessionWithRole('u5555000001@test.local', 'Broker');
    const requester = await sessionWithRole('u5555000002@test.local', 'RegularUser');

    await request(httpServer(testApp))
      .post('/api/v1/device-tokens')
      .set('Authorization', `Bearer ${broker.accessToken}`)
      .send({ token: 'broker-device-token-1', deviceType: 'ios' })
      .expect(201);

    await request(httpServer(testApp))
      .post('/api/v1/device-tokens')
      .set('Authorization', `Bearer ${broker.accessToken}`)
      .send({ token: 'broker-device-token-2', deviceType: 'android' })
      .expect(201);

    const persistedTokens = await testApp.prisma.deviceToken.findMany({
      where: { userId: broker.user.id, isActive: true },
      orderBy: { token: 'asc' }
    });
    expect(persistedTokens.map((row) => row.token)).toEqual([
      'broker-device-token-1',
      'broker-device-token-2'
    ]);

    const stub = testApp.app.get<PushDispatcher>(PUSH_DISPATCHER) as StubAdapter;
    stub.dispatchLog.length = 0;

    const payload = await makePropertyRequestPayload(testApp.prisma);
    await request(httpServer(testApp))
      .post('/api/v1/property-requests')
      .set('Authorization', `Bearer ${requester.accessToken}`)
      .send(payload)
      .expect(202);

    await testApp.app.get(FanoutWorker).drainOnce();

    const dispatchedTokens = stub.dispatchLog.flatMap((entry) => entry.tokens);
    expect(dispatchedTokens).toEqual(
      expect.arrayContaining(['broker-device-token-1', 'broker-device-token-2'])
    );
  });

  it('unregisters a token (DELETE) and rejects unauthenticated callers', async () => {
    const broker = await sessionWithRole('u5555000003@test.local', 'Broker');
    await request(httpServer(testApp))
      .post('/api/v1/device-tokens')
      .set('Authorization', `Bearer ${broker.accessToken}`)
      .send({ token: 'ephemeral-token', deviceType: 'web' })
      .expect(201);

    await request(httpServer(testApp))
      .delete('/api/v1/device-tokens/ephemeral-token')
      .set('Authorization', `Bearer ${broker.accessToken}`)
      .expect(204);

    expect(
      await testApp.prisma.deviceToken.count({
        where: { token: 'ephemeral-token' }
      })
    ).toBe(0);

    await request(httpServer(testApp))
      .post('/api/v1/device-tokens')
      .send({ token: 'no-auth-token', deviceType: 'ios' })
      .expect(401);
  });

  async function sessionWithRole(email: string, role: 'RegularUser' | 'Broker' | 'Agency') {
    const first = await issueSession(testApp, email);
    await request(httpServer(testApp))
      .post('/api/v1/auth/select-role')
      .set('Authorization', `Bearer ${first.accessToken}`)
      .send({ role, officeName: `${role} Office` });
    return issueSession(testApp, email);
  }
});
