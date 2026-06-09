import request from 'supertest';
import { BlockedIdentityService } from '../../src/modules/blocklist/blocked-identity.service.js';
import { adminSession, sessionWithRole } from '../helpers/admin-helpers.js';
import {
  closeAuthTestApp,
  createAuthTestApp,
  httpServer,
  issueSession,
  TEST_PASSWORD,
  type AuthTestApp
} from '../helpers/auth-test-app.js';

interface BlockedIdentityPage {
  items: Array<{
    id: string;
    email?: string | null;
    phone?: string | null;
    reason?: string | null;
  }>;
}

describe('blocked identities on account delete (e2e)', () => {
  jest.setTimeout(120_000);

  let testApp: AuthTestApp;
  const rand = () => Math.random().toString(36).substring(2, 8);

  beforeAll(async () => {
    testApp = await createAuthTestApp();
  });

  afterAll(async () => {
    await closeAuthTestApp(testApp);
  });

  it('blocks email/phone after self-delete and lists them for admin', async () => {
    const r = rand();
    const email = `deleted_${r}@test.local`;
    const session = await sessionWithRole(testApp, email, 'RegularUser');

    await request(httpServer(testApp))
      .delete('/api/v1/users/account')
      .set('Authorization', `Bearer ${session.accessToken}`)
      .expect(204);

    await request(httpServer(testApp))
      .post('/api/v1/auth/register')
      .send({ email, password: TEST_PASSWORD, displayName: 'Blocked Retry' })
      .expect(409)
      .expect(({ body }) => {
        expect((body as { code: string }).code).toBe('identityBlocked');
      });

    const admin = await adminSession(testApp, `blocklist_admin_${r}@test.local`);
    await request(httpServer(testApp))
      .get('/api/v1/admin/blocked-identities')
      .set('Authorization', `Bearer ${admin.accessToken}`)
      .expect(200)
      .expect(({ body }) => {
        const page = body as BlockedIdentityPage;
        expect(page.items.some((row) => row.email === email)).toBe(true);
      });
  });

  it('backfills identities for accounts deleted before blocklist rows existed', async () => {
    const r = rand();
    const email = `legacy_deleted_${r}@test.local`;
    const session = await issueSession(testApp, email);
    await testApp.prisma.user.update({
      where: { id: session.user.id },
      data: { deletedAt: new Date() }
    });

    const blocklist = testApp.app.get(BlockedIdentityService);
    const added = await blocklist.reconcileFromDeletedUsers();
    expect(added).toBeGreaterThanOrEqual(1);

    const admin = await adminSession(testApp, `legacy_admin_${r}@test.local`);
    await request(httpServer(testApp))
      .get('/api/v1/admin/blocked-identities')
      .set('Authorization', `Bearer ${admin.accessToken}`)
      .expect(200)
      .expect(({ body }) => {
        const page = body as BlockedIdentityPage;
        expect(page.items.some((row) => row.email === email)).toBe(true);
      });
  });
});
