import request from 'supertest';
import { MAIL_SENDER, StubMailSender } from '../../src/infra/mail/mail.provider.js';
import {
  closeAuthTestApp,
  createAuthTestApp,
  httpServer,
  TEST_PASSWORD,
  type AuthTestApp
} from '../helpers/auth-test-app.js';

jest.setTimeout(60_000);

describe('auth password reset (e2e)', () => {
  let testApp: AuthTestApp;
  let mail: StubMailSender;

  beforeAll(async () => {
    testApp = await createAuthTestApp();
    mail = testApp.app.get(MAIL_SENDER) as StubMailSender;
  });

  afterAll(async () => {
    await closeAuthTestApp(testApp);
  });

  beforeEach(() => {
    mail.clear();
  });

  it('resets password via email code and allows login with the new password', async () => {
    const email = 'reset.flow@example.com';
    const oldPassword = TEST_PASSWORD;
    const newPassword = 'brand-new-pass-99';

    await request(httpServer(testApp))
      .post('/api/v1/auth/register')
      .send({ email, password: oldPassword, displayName: 'Reset User' })
      .expect(201);

    await request(httpServer(testApp))
      .post('/api/v1/auth/password-reset/request')
      .send({ email })
      .expect(204);

    const code = mail.lastCode();
    expect(code).toMatch(/^\d{6}$/);

    const verify = await request(httpServer(testApp))
      .post('/api/v1/auth/password-reset/verify')
      .send({ email, code })
      .expect(200);

    await request(httpServer(testApp))
      .post('/api/v1/auth/password-reset/confirm')
      .send({
        email,
        resetToken: verify.body.resetToken,
        password: newPassword
      })
      .expect(204);

    await request(httpServer(testApp))
      .post('/api/v1/auth/login')
      .send({ email, password: oldPassword })
      .expect(401);

    await request(httpServer(testApp))
      .post('/api/v1/auth/login')
      .send({ email, password: newPassword })
      .expect(200);
  });

  it('returns 204 for unknown email without sending mail', async () => {
    await request(httpServer(testApp))
      .post('/api/v1/auth/password-reset/request')
      .send({ email: 'nobody.reset@example.com' })
      .expect(204);

    expect(mail.sent).toHaveLength(0);
  });

  it('rejects invalid verification code with 401', async () => {
    const email = 'reset.badcode@example.com';
    await request(httpServer(testApp))
      .post('/api/v1/auth/register')
      .send({ email, password: TEST_PASSWORD, displayName: 'Bad Code' })
      .expect(201);

    await request(httpServer(testApp))
      .post('/api/v1/auth/password-reset/request')
      .send({ email })
      .expect(204);

    await request(httpServer(testApp))
      .post('/api/v1/auth/password-reset/verify')
      .send({ email, code: '000000' })
      .expect(401);
  });

  it('returns 429 when too many reset requests are issued within an hour', async () => {
    const email = 'reset.ratelimit@example.com';
    await request(httpServer(testApp))
      .post('/api/v1/auth/register')
      .send({ email, password: TEST_PASSWORD, displayName: 'Rate Limit' })
      .expect(201);

    for (let i = 0; i < 3; i += 1) {
      await request(httpServer(testApp))
        .post('/api/v1/auth/password-reset/request')
        .send({ email })
        .expect(204);
    }

    const limited = await request(httpServer(testApp))
      .post('/api/v1/auth/password-reset/request')
      .send({ email });

    expect(limited.status).toBe(429);
    expect(limited.body.code).toBe('tooManyRequests');
    expect(limited.body.retryAfterSeconds).toBeGreaterThan(0);
  });
});
