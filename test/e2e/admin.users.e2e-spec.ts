import request from 'supertest';
import { adminSession, sessionWithRole } from '../helpers/admin-helpers.js';
import {
  closeAuthTestApp,
  createAuthTestApp,
  httpServer,
  type AuthTestApp
} from '../helpers/auth-test-app.js';
import { seedArea, seedCity, seedProperty } from '../helpers/test-db.js';

interface UserAdminPage {
  items: Array<{
    id: string;
    email: string;
    role: string | null;
    isActive: boolean;
    propertyCount: number;
  }>;
  pageInfo: { totalItems: number };
}

describe('admin users (e2e)', () => {
  let testApp: AuthTestApp;

  beforeAll(async () => {
    testApp = await createAuthTestApp();
  });

  afterAll(async () => {
    await closeAuthTestApp(testApp);
  });

  it('lists users with filters and disables a user, bumping tokenVersion and hiding listings', async () => {
    const admin = await adminSession(testApp, 'u5553000001@test.local');
    const broker = await sessionWithRole(testApp, 'u5553000002@test.local', 'Broker');
    await sessionWithRole(testApp, 'u5553000003@test.local', 'RegularUser');

    const city = await seedCity(testApp.prisma, 'admin-users-city');
    const area = await seedArea(testApp.prisma, city.id, 'admin-users-area');
    await seedProperty(testApp.prisma, {
      ownerId: broker.user.id,
      title: 'Broker Listing',
      propertyType: 'apartment',
      listingType: 'sale',
      price: 100000,
      city: city.id,
      area: area.id,
      rooms: 2,
      furnished: 'unfurnished',
      createdAt: new Date(),
      objectKeySuffix: 'broker-listing'
    });

    await request(httpServer(testApp))
      .get('/api/v1/properties')
      .expect(200)
      .expect(({ body }) => {
        expect((body as { items: Array<{ id: string }> }).items.length).toBeGreaterThan(0);
      });

    const listResp = await request(httpServer(testApp))
      .get('/api/v1/admin/users')
      .query({ role: 'Broker' })
      .set('Authorization', `Bearer ${admin.accessToken}`)
      .expect(200);
    const page = listResp.body as UserAdminPage;
    expect(page.items.find((u) => u.id === broker.user.id)).toBeDefined();
    expect(page.items.find((u) => u.id === broker.user.id)?.propertyCount).toBe(1);

    await request(httpServer(testApp))
      .patch(`/api/v1/admin/users/${broker.user.id}/status`)
      .set('Authorization', `Bearer ${admin.accessToken}`)
      .send({ isActive: false, reason: 'policy violation' })
      .expect(200)
      .expect(({ body }) => {
        expect((body as { isActive: boolean }).isActive).toBe(false);
      });

    await request(httpServer(testApp))
      .get('/api/v1/auth/me')
      .set('Authorization', `Bearer ${broker.accessToken}`)
      .expect(401);

    await request(httpServer(testApp))
      .get('/api/v1/properties')
      .expect(200)
      .expect(({ body }) => {
        const items = (body as { items: Array<{ id: string }> }).items;
        expect(items.length).toBe(0);
      });

    const auditCount = await testApp.prisma.auditEvent.count({
      where: { action: 'admin.user_disabled', targetId: broker.user.id }
    });
    expect(auditCount).toBe(1);
  });
});
