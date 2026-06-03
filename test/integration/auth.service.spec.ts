import { AuthService } from '../../src/modules/auth/auth.service.js';
import {
  TEST_PASSWORD,
  closeAuthTestApp,
  createAuthTestApp,
  type AuthTestApp
} from '../helpers/auth-test-app.js';

describe('AuthService (integration)', () => {
  let testApp: AuthTestApp;
  let authService: AuthService;

  beforeAll(async () => {
    testApp = await createAuthTestApp();
    authService = testApp.app.get(AuthService);
  });

  afterAll(async () => {
    await closeAuthTestApp(testApp);
  });

  it('registers users, recognizes returning logins, rotates refresh tokens, and bumps tokenVersion on logout', async () => {
    const email = 'rotation.user@example.com';
    const first = await authService.register(email, TEST_PASSWORD, 'Rotation User', 'device-a');
    expect(first.roleSelectionRequired).toBe(true);
    expect(first.user.email).toBe(email);

    const returning = await authService.login(email, TEST_PASSWORD, 'device-a');
    expect(returning.user.id).toBe(first.user.id);

    const rotated = await authService.refresh(returning.refreshToken);
    expect(rotated.refreshToken).not.toBe(returning.refreshToken);
    await expect(authService.refresh(returning.refreshToken)).rejects.toThrow();

    await authService.logout(returning.user.id, rotated.refreshToken);
    const activeTokens = await testApp.prisma.refreshToken.count({
      where: { revokedAt: null }
    });
    // Two sessions were issued (register + login); logout revokes the rotated
    // login token, leaving only the original register session active.
    expect(activeTokens).toBe(1);

    const user = await testApp.prisma.user.findUnique({ where: { email } });
    expect(user?.tokenVersion).toBe(1);
  });
});
