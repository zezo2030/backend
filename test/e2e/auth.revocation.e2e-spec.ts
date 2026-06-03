import request from 'supertest';
import {
  closeAuthTestApp,
  createAuthTestApp,
  httpServer,
  issueSession,
  type AuthTestApp,
  type ErrorBody
} from '../helpers/auth-test-app.js';

describe('auth token revocation (e2e)', () => {
  let testApp: AuthTestApp;

  beforeAll(async () => {
    testApp = await createAuthTestApp();
  });

  afterAll(async () => {
    await closeAuthTestApp(testApp);
  });

  it('rejects the next request with the same access token after logout', async () => {
    const session = await issueSession(testApp, 'u5550001003@test.local');

    await request(httpServer(testApp))
      .post('/api/v1/auth/logout')
      .set('Authorization', `Bearer ${session.accessToken}`)
      .send({ refreshToken: session.refreshToken })
      .expect(204);

    await request(httpServer(testApp))
      .get('/api/v1/auth/me')
      .set('Authorization', `Bearer ${session.accessToken}`)
      .expect(401)
      .expect(({ body }) => {
        expect((body as ErrorBody).code).toBe('invalidTokenVersion');
      });
  });
});
