import request from 'supertest';
import {
  closeAuthTestApp,
  createAuthTestApp,
  httpServer,
  issueSession,
  type AuthResponseBody,
  type AuthTestApp
} from '../helpers/auth-test-app.js';

describe('auth refresh rotation (e2e)', () => {
  let testApp: AuthTestApp;

  beforeAll(async () => {
    testApp = await createAuthTestApp();
  });

  afterAll(async () => {
    await closeAuthTestApp(testApp);
  });

  it('rotates refresh tokens and rejects the old token', async () => {
    const session = await issueSession(testApp, 'u5550001004@test.local');

    const rotated = await request(httpServer(testApp))
      .post('/api/v1/auth/refresh')
      .send({ refreshToken: session.refreshToken })
      .expect(200)
      .then((response) => response.body as AuthResponseBody);

    expect(rotated.refreshToken).not.toBe(session.refreshToken);

    await request(httpServer(testApp))
      .post('/api/v1/auth/refresh')
      .send({ refreshToken: session.refreshToken })
      .expect(401);

    await request(httpServer(testApp))
      .get('/api/v1/auth/me')
      .set('Authorization', `Bearer ${rotated.accessToken}`)
      .expect(200);
  });
});
