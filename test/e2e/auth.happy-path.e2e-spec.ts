import request from 'supertest';
import {
  TEST_PASSWORD,
  closeAuthTestApp,
  createAuthTestApp,
  httpServer,
  type AuthResponseBody,
  type AuthTestApp,
  type UserSelfBody
} from '../helpers/auth-test-app.js';

describe('auth happy path (e2e)', () => {
  let testApp: AuthTestApp;

  beforeAll(async () => {
    testApp = await createAuthTestApp();
  });

  afterAll(async () => {
    await closeAuthTestApp(testApp);
  });

  it('registers, selects a role, logs in, and returns /auth/me', async () => {
    const email = 'happy.path@example.com';

    const session = await request(httpServer(testApp))
      .post('/api/v1/auth/register')
      .send({ email, password: TEST_PASSWORD, displayName: 'Happy Path', deviceId: 'ios-device-1' })
      .expect(201)
      .expect(({ body }) => {
        const responseBody = body as AuthResponseBody;
        expect(typeof responseBody.accessToken).toBe('string');
        expect(typeof responseBody.refreshToken).toBe('string');
        expect(responseBody.expiresInSec).toBe(900);
        expect(responseBody.roleSelectionRequired).toBe(true);
        expect(responseBody.user.email).toBe(email);
        expect(responseBody.user.role).toBeNull();
      });

    const sessionBody = session.body as AuthResponseBody;
    await request(httpServer(testApp))
      .post('/api/v1/auth/select-role')
      .set('Authorization', `Bearer ${sessionBody.accessToken}`)
      .send({ role: 'Broker', officeName: 'North Star Realty' })
      .expect(200)
      .expect(({ body }) => {
        expect((body as UserSelfBody).role).toBe('Broker');
      });

    // Logging in again returns a session that reflects the selected role.
    await request(httpServer(testApp))
      .post('/api/v1/auth/login')
      .send({ email, password: TEST_PASSWORD })
      .expect(200);

    await request(httpServer(testApp))
      .get('/api/v1/auth/me')
      .set('Authorization', `Bearer ${sessionBody.accessToken}`)
      .expect(200)
      .expect(({ body }) => {
        const responseBody = body as UserSelfBody;
        expect(responseBody.email).toBe(email);
        expect(responseBody.role).toBe('Broker');
      });
  });
});
