import request from 'supertest';
import { adminSession, sessionWithRole } from '../helpers/admin-helpers.js';
import {
  closeAuthTestApp,
  createAuthTestApp,
  httpServer,
  type AuthTestApp
} from '../helpers/auth-test-app.js';
import { seedArea, seedCity, seedProperty } from '../helpers/test-db.js';

interface ReportBody {
  id: string;
  status: string;
  resolvedAction: string | null;
}

describe('reports resolve with action (e2e)', () => {
  let testApp: AuthTestApp;

  beforeAll(async () => {
    testApp = await createAuthTestApp();
  });

  afterAll(async () => {
    await closeAuthTestApp(testApp);
  });

  async function seedListing(ownerId: string): Promise<string> {
    const city = await seedCity(testApp.prisma, `report-resolve-city-${Date.now()}`);
    const area = await seedArea(testApp.prisma, city.id, `report-resolve-area-${Date.now()}`);
    const created = await seedProperty(testApp.prisma, {
      ownerId,
      title: 'Target listing',
      propertyType: 'apartment',
      listingType: 'sale',
      price: 100000,
      cityId: city.id,
      areaId: area.id,
      rooms: 2,
      furnished: 'unfurnished',
      createdAt: new Date(),
      objectKeySuffix: 'target-listing'
    });
    return created.id;
  }

  it('resolves a broker report with disabled_account: target disabled, next call 401', async () => {
    const admin = await adminSession(testApp, 'u5554200001@test.local');
    const target = await sessionWithRole(testApp, 'u5554200002@test.local', 'Broker');
    const reporter = await sessionWithRole(testApp, 'u5554200003@test.local', 'RegularUser');

    const created = await request(httpServer(testApp))
      .post('/api/v1/reports')
      .set('Authorization', `Bearer ${reporter.accessToken}`)
      .send({ targetType: 'broker', targetId: target.user.id, reason: 'scam' })
      .expect(201);
    const reportId = (created.body as ReportBody).id;

    const resolveResp = await request(httpServer(testApp))
      .post(`/api/v1/admin/reports/${reportId}/resolve`)
      .set('Authorization', `Bearer ${admin.accessToken}`)
      .send({ outcome: 'resolved', action: 'disabled_account' })
      .expect(200);
    const resolved = resolveResp.body as ReportBody;
    expect(resolved.status).toBe('resolved');
    expect(resolved.resolvedAction).toBe('disabled_account');

    await request(httpServer(testApp))
      .get('/api/v1/auth/me')
      .set('Authorization', `Bearer ${target.accessToken}`)
      .expect(401);
  });

  it('resolves a property report with deleted_listing: listing is soft-deleted', async () => {
    const admin = await adminSession(testApp, 'u5554200010@test.local');
    const owner = await sessionWithRole(testApp, 'u5554200011@test.local', 'Broker');
    const reporter = await sessionWithRole(testApp, 'u5554200012@test.local', 'RegularUser');
    const listingId = await seedListing(owner.user.id);

    const created = await request(httpServer(testApp))
      .post('/api/v1/reports')
      .set('Authorization', `Bearer ${reporter.accessToken}`)
      .send({ targetType: 'property', targetId: listingId, reason: 'duplicate' })
      .expect(201);
    const reportId = (created.body as ReportBody).id;

    await request(httpServer(testApp))
      .post(`/api/v1/admin/reports/${reportId}/resolve`)
      .set('Authorization', `Bearer ${admin.accessToken}`)
      .send({ outcome: 'resolved', action: 'deleted_listing' })
      .expect(200)
      .expect(({ body }) => {
        const resolved = body as ReportBody;
        expect(resolved.status).toBe('resolved');
        expect(resolved.resolvedAction).toBe('deleted_listing');
      });

    const listing = await testApp.prisma.property.findUnique({ where: { id: listingId } });
    expect(listing?.deletedAt).toBeInstanceOf(Date);
  });

  it('rejects deleted_listing on a user target with 422', async () => {
    const admin = await adminSession(testApp, 'u5554200020@test.local');
    const target = await sessionWithRole(testApp, 'u5554200021@test.local', 'RegularUser');
    const reporter = await sessionWithRole(testApp, 'u5554200022@test.local', 'RegularUser');

    const created = await request(httpServer(testApp))
      .post('/api/v1/reports')
      .set('Authorization', `Bearer ${reporter.accessToken}`)
      .send({ targetType: 'user', targetId: target.user.id, reason: 'spam' })
      .expect(201);
    const reportId = (created.body as ReportBody).id;

    await request(httpServer(testApp))
      .post(`/api/v1/admin/reports/${reportId}/resolve`)
      .set('Authorization', `Bearer ${admin.accessToken}`)
      .send({ outcome: 'resolved', action: 'deleted_listing' })
      .expect(422);
  });
});
