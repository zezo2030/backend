import { MAIL_SENDER, StubMailSender } from '../../src/infra/mail/mail.provider.js';
import { PasswordResetService } from '../../src/modules/auth/password-reset.service.js';
import {
  TEST_PASSWORD,
  closeAuthTestApp,
  createAuthTestApp,
  type AuthTestApp
} from '../helpers/auth-test-app.js';
import { AuthService } from '../../src/modules/auth/auth.service.js';

describe('PasswordResetService (integration)', () => {
  let testApp: AuthTestApp;
  let passwordResetService: PasswordResetService;
  let authService: AuthService;
  let mail: StubMailSender;

  beforeAll(async () => {
    testApp = await createAuthTestApp();
    passwordResetService = testApp.app.get(PasswordResetService);
    authService = testApp.app.get(AuthService);
    mail = testApp.app.get(MAIL_SENDER) as StubMailSender;
  });

  afterAll(async () => {
    await closeAuthTestApp(testApp);
  });

  beforeEach(() => {
    mail.clear();
  });

  it('revokes refresh tokens after password reset', async () => {
    const email = 'reset.revoke@example.com';
    const session = await authService.register(email, TEST_PASSWORD, 'Revoke User');
    const newPassword = 'another-new-pass-88';

    await passwordResetService.requestReset(email);
    const code = mail.lastCode();
    expect(code).toBeDefined();

    const { resetToken } = await passwordResetService.verifyCode(email, code!);
    await passwordResetService.confirmReset(email, resetToken, newPassword);

    await expect(authService.refresh(session.refreshToken)).rejects.toThrow();

    const activeTokens = await testApp.prisma.refreshToken.count({
      where: { userId: session.user.id, revokedAt: null }
    });
    expect(activeTokens).toBe(0);

    const user = await testApp.prisma.user.findUnique({ where: { email } });
    expect(user?.tokenVersion).toBe(1);
  });
});
