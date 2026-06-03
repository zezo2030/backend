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
  targetType: string;
  targetId: string;
  status: string;
  reason: string;
}

interface AdminReportsPage {
  items: ReportBody[];
  pageInfo: { totalItems: number };
}

describe('reports create and list (e2e)', () => {
  let testApp: AuthTestApp;

  beforeAll(async () => {
    testApp = await createAuthTestApp();
  });

  afterAll(async () => {
    await closeAuthTestApp(testApp);
  });

  async function seedListing(ownerId: string): Promise<string> {
    const city = await seedCity(testApp.prisma, `report-list-city-${Date.now()}`);
    const area = await seedArea(testApp.prisma, city.id, `report-list-area-${Date.now()}`);
    const created = await seedProperty(testApp.prisma, {
      ownerId,
      title: 'Reportable',
      propertyType: 'apartment',
      listingType: 'sale',
      price: 100000,
      cityId: city.id,
      areaId: area.id,
      rooms: 2,
      furnished: 'unfurnished',
      createdAt: new Date(),
      objectKeySuffix: 'reportable'
    });
    return created.id;
  }

  it('user submits a report; admin lists with filters', async () => {
    const admin = await adminSession(testApp, 'u5554100001@test.local');
    const owner = await sessionWithRole(testApp, 'u5554100002@test.local', 'Broker');
    const reporter = await sessionWithRole(testApp, 'u5554100003@test.local', 'RegularUser');
    const listingId = await seedListing(owner.user.id);

    const created = await request(httpServer(testApp))
      .post('/api/v1/reports')
      .set('Authorization', `Bearer ${reporter.accessToken}`)
      .send({ targetType: 'property', targetId: listingId, reason: 'inappropriate content' })
      .expect(201);
    const body = created.body as ReportBody;
    expect(body.status).toBe('open');
    expect(body.targetId).toBe(listingId);
    expect(body.reason).toBe('inappropriate content');

    const queue = await request(httpServer(testApp))
      .get('/api/v1/admin/reports')
      .query({ status: 'open', targetType: 'property' })
      .set('Authorization', `Bearer ${admin.accessToken}`)
      .expect(200);
    const page = queue.body as AdminReportsPage;
    expect(page.items.find((item) => item.id === body.id)).toBeDefined();
    expect(page.pageInfo.totalItems).toBeGreaterThanOrEqual(1);
  });

  it('rejects a report against a non-existent target with 422', async () => {
    const reporter = await sessionWithRole(testApp, 'u5554100010@test.local', 'RegularUser');
    await request(httpServer(testApp))
      .post('/api/v1/reports')
      .set('Authorization', `Bearer ${reporter.accessToken}`)
      .send({
        targetType: 'property',
        targetId: 'clnonexistent000000000000000',
        reason: 'ghost target'
      })
      .expect(422);
  });

  it('reports endpoint requires authentication', async () => {
    await request(httpServer(testApp))
      .post('/api/v1/reports')
      .send({
        targetType: 'property',
        targetId: 'clnonexistent000000000000001',
        reason: 'unauth'
      })
      .expect(401);
  });
});
