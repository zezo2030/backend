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
  const rand = () => Math.random().toString(36).substring(2, 8);

  beforeAll(async () => {
    testApp = await createAuthTestApp();
  });

  afterAll(async () => {
    await closeAuthTestApp(testApp);
  });

  it('lists users with filters and disables a user, bumping tokenVersion and hiding listings', async () => {
    const r = rand();
    const admin = await adminSession(testApp, `admin_${r}@test.local`);
    const broker = await sessionWithRole(testApp, `broker_${r}@test.local`, 'Broker');
    await sessionWithRole(testApp, `user_${r}@test.local`, 'RegularUser');

    const city = await seedCity(testApp.prisma, 'admin-users-city');
    const area = await seedArea(testApp.prisma, city.id, 'admin-users-area');
    const property = await seedProperty(testApp.prisma, {
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
        expect(items.some((item) => item.id === property.id)).toBe(false);
      });

    const auditCount = await testApp.prisma.auditEvent.count({
      where: { action: 'admin.user_disabled', targetId: broker.user.id }
    });
    expect(auditCount).toBe(1);
  });

  it('supports broker approval flow and audits it', async () => {
    const r = rand();
    const admin = await adminSession(testApp, `admin_app_${r}@test.local`);
    const broker = await sessionWithRole(testApp, `broker_app_${r}@test.local`, 'Broker');

    // By default, a new broker is not approved
    const meBefore = await request(httpServer(testApp))
      .get('/api/v1/auth/me')
      .set('Authorization', `Bearer ${broker.accessToken}`)
      .expect(200);
    expect(meBefore.body.isApproved).toBe(false);

    // Admin approves the broker
    await request(httpServer(testApp))
      .patch(`/api/v1/admin/users/${broker.user.id}/approve-broker`)
      .set('Authorization', `Bearer ${admin.accessToken}`)
      .expect(200)
      .expect(({ body }) => {
        expect(body.isApproved).toBe(true);
      });

    // Check again
    const meAfter = await request(httpServer(testApp))
      .get('/api/v1/auth/me')
      .set('Authorization', `Bearer ${broker.accessToken}`)
      .expect(200);
    expect(meAfter.body.isApproved).toBe(true);

    const auditCount = await testApp.prisma.auditEvent.count({
      where: { action: 'admin.broker_approved', targetId: broker.user.id }
    });
    expect(auditCount).toBe(1);
  });
});
