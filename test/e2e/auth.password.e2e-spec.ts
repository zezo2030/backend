import request from 'supertest';
import {
  closeAuthTestApp,
  createAuthTestApp,
  httpServer,
  type AuthResponseBody,
  type ErrorBody,
  type AuthTestApp
} from '../helpers/auth-test-app.js';

describe('auth email + password (e2e)', () => {
  let testApp: AuthTestApp;

  beforeAll(async () => {
    testApp = await createAuthTestApp();
  });

  afterAll(async () => {
    await closeAuthTestApp(testApp);
  });

  it('registers a new account and returns a session pending role selection', async () => {
    const email = 'password.user@example.com';
    const response = await request(httpServer(testApp))
      .post('/api/v1/auth/register')
      .send({ email, password: 'sup3rsecret', displayName: 'Pass User', deviceId: 'd1' })
      .expect(201);

    const body = response.body as AuthResponseBody;
    expect(typeof body.accessToken).toBe('string');
    expect(typeof body.refreshToken).toBe('string');
    expect(body.roleSelectionRequired).toBe(true);
    expect(body.user.email).toBe(email);
    expect(body.user.role).toBeNull();
  });

  it('rejects a duplicate registration with 409', async () => {
    const email = 'dupe.user@example.com';
    await request(httpServer(testApp))
      .post('/api/v1/auth/register')
      .send({ email, password: 'sup3rsecret', displayName: 'Dupe' })
      .expect(201);

    const conflict = await request(httpServer(testApp))
      .post('/api/v1/auth/register')
      .send({ email, password: 'sup3rsecret', displayName: 'Dupe Again' })
      .expect(409);
    expect((conflict.body as ErrorBody).code).toBe('conflict');
  });

  it('rejects registration with a too-short password', async () => {
    await request(httpServer(testApp))
      .post('/api/v1/auth/register')
      .send({ email: 'short.pw@example.com', password: 'short', displayName: 'Shorty' })
      .expect(400);
  });

  it('logs in with correct credentials', async () => {
    const email = 'login.user@example.com';
    await request(httpServer(testApp))
      .post('/api/v1/auth/register')
      .send({ email, password: 'sup3rsecret', displayName: 'Login User' })
      .expect(201);

    const response = await request(httpServer(testApp))
      .post('/api/v1/auth/login')
      .send({ email, password: 'sup3rsecret', deviceId: 'd2' })
      .expect(200);

    const body = response.body as AuthResponseBody;
    expect(typeof body.accessToken).toBe('string');
    expect(body.user.email).toBe(email);

    // The freshly issued access token is accepted by a protected endpoint.
    await request(httpServer(testApp))
      .get('/api/v1/auth/me')
      .set('Authorization', `Bearer ${body.accessToken}`)
      .expect(200)
      .expect(({ body: me }) => {
        expect((me as AuthResponseBody['user']).email).toBe(email);
      });
  });

  it('rejects login with a wrong password', async () => {
    const email = 'wrongpw.user@example.com';
    await request(httpServer(testApp))
      .post('/api/v1/auth/register')
      .send({ email, password: 'sup3rsecret', displayName: 'Wrong PW' })
      .expect(201);

    await request(httpServer(testApp))
      .post('/api/v1/auth/login')
      .send({ email, password: 'not-the-password' })
      .expect(401);
  });

  it('rejects login for an unknown email with 401', async () => {
    await request(httpServer(testApp))
      .post('/api/v1/auth/login')
      .send({ email: 'nobody.here@example.com', password: 'whatever123' })
      .expect(401);
  });

  it('lets a passwordless account attach a password, then log in with it', async () => {
    const email = 'passwordless.then.password@example.com';
    // Account that exists without a password (e.g. admin-provisioned).
    await testApp.prisma.user.create({
      data: {
        email,
        displayName: 'Passwordless First',
        role: null,
        isActive: true,
        isVerified: true,
        tokenVersion: 0,
        deletedAt: null
      }
    });

    await request(httpServer(testApp))
      .post('/api/v1/auth/register')
      .send({ email, password: 'brandnewpass', displayName: 'Ignored' })
      .expect(201);

    await request(httpServer(testApp))
      .post('/api/v1/auth/login')
      .send({ email, password: 'brandnewpass' })
      .expect(200);
  });
});
