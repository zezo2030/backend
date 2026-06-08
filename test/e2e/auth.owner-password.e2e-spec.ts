import bcrypt from 'bcrypt';
import request from 'supertest';
import { adminSession } from '../helpers/admin-helpers.js';
import {
  TEST_PASSWORD,
  closeAuthTestApp,
  createAuthTestApp,
  httpServer,
  type AuthTestApp
} from '../helpers/auth-test-app.js';

describe('auth owner password change (e2e)', () => {
  let testApp: AuthTestApp;

  jest.setTimeout(120_000);

  beforeAll(async () => {
    testApp = await createAuthTestApp();
  }, 120_000);

  afterAll(async () => {
    await closeAuthTestApp(testApp);
  });

  async function ownerSession(
    email: string,
    password = TEST_PASSWORD
  ): Promise<{ accessToken: string; refreshToken: string; userId: string }> {
    const passwordHash = await bcrypt.hash(password, 10);
    const user = await testApp.prisma.user.create({
      data: {
        email,
        displayName: 'Owner',
        passwordHash,
        role: 'Admin',
        isOwner: true,
        isActive: true,
        isVerified: true,
        tokenVersion: 0
      }
    });
    const login = await request(httpServer(testApp))
      .post('/api/v1/auth/login')
      .send({ email, password, deviceId: 'test-device' })
      .expect(200);
    const session = login.body as { accessToken: string; refreshToken: string };
    return {
      accessToken: session.accessToken,
      refreshToken: session.refreshToken,
      userId: user.id
    };
  }

  it('lets the owner change password and revokes existing sessions', async () => {
    const email = 'owner.pw@example.com';
    const { accessToken, refreshToken } = await ownerSession(email, 'old-password-1');

    await request(httpServer(testApp))
      .post('/api/v1/auth/me/change-password')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ currentPassword: 'old-password-1', newPassword: 'new-password-9' })
      .expect(204);

    await request(httpServer(testApp))
      .post('/api/v1/auth/login')
      .send({ email, password: 'old-password-1' })
      .expect(401);

    await request(httpServer(testApp))
      .post('/api/v1/auth/login')
      .send({ email, password: 'new-password-9' })
      .expect(200);

    await request(httpServer(testApp))
      .post('/api/v1/auth/refresh')
      .send({ refreshToken })
      .expect(401);
  });

  it('rejects a wrong current password', async () => {
    const email = 'owner.wrongpw@example.com';
    const { accessToken } = await ownerSession(email, 'correct-password');

    await request(httpServer(testApp))
      .post('/api/v1/auth/me/change-password')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ currentPassword: 'wrong-password', newPassword: 'new-password-9' })
      .expect(401);
  });

  it('returns 403 for non-owner admins', async () => {
    const admin = await adminSession(testApp, 'staff.admin@example.com');

    await request(httpServer(testApp))
      .post('/api/v1/auth/me/change-password')
      .set('Authorization', `Bearer ${admin.accessToken}`)
      .send({ currentPassword: TEST_PASSWORD, newPassword: 'new-password-9' })
      .expect(403)
      .expect(({ body }) => {
        expect(body.code).toBe('ownerOnly');
      });
  });

  it('returns 401 when unauthenticated', async () => {
    await request(httpServer(testApp))
      .post('/api/v1/auth/me/change-password')
      .send({ currentPassword: 'a', newPassword: 'new-password-9' })
      .expect(401);
  });
});
