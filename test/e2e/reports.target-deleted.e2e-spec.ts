import request from 'supertest';
import { adminSession, sessionWithRole } from '../helpers/admin-helpers.js';
import { ReportTargetReconciler } from '../../src/modules/reports/report-target-reconciler.service.js';
import {
  closeAuthTestApp,
  createAuthTestApp,
  httpServer,
  type AuthTestApp
} from '../helpers/auth-test-app.js';
import { seedArea, seedCity, seedProperty } from '../helpers/test-db.js';

interface ReportBody {
  id: string;
  targetDeleted: boolean;
}

interface AdminReportsPage {
  items: Array<{ id: string; targetDeleted: boolean; status: string }>;
}

describe('reports target deleted (e2e)', () => {
  let testApp: AuthTestApp;

  beforeAll(async () => {
    testApp = await createAuthTestApp();
  });

  afterAll(async () => {
    await closeAuthTestApp(testApp);
  });

  it('reconciler flips targetDeleted when the listing owner soft-deletes it', async () => {
    const admin = await adminSession(testApp, 'u5554300001@test.local');
    const owner = await sessionWithRole(testApp, 'u5554300002@test.local', 'Broker');
    const reporter = await sessionWithRole(testApp, 'u5554300003@test.local', 'RegularUser');

    const city = await seedCity(testApp.prisma, 'target-deleted-city');
    const area = await seedArea(testApp.prisma, city.id, 'target-deleted-area');
    const listing = await seedProperty(testApp.prisma, {
      ownerId: owner.user.id,
      title: 'About to be deleted',
      propertyType: 'apartment',
      listingType: 'sale',
      price: 100000,
      cityId: city.id,
      areaId: area.id,
      rooms: 2,
      furnished: 'unfurnished',
      createdAt: new Date(),
      objectKeySuffix: 'target-deleted'
    });
    const listingId = listing.id;

    const created = await request(httpServer(testApp))
      .post('/api/v1/reports')
      .set('Authorization', `Bearer ${reporter.accessToken}`)
      .send({ targetType: 'property', targetId: listingId, reason: 'fake' })
      .expect(201);
    const reportId = (created.body as ReportBody).id;

    await testApp.prisma.property.update({
      where: { id: listingId },
      data: { deletedAt: new Date() }
    });

    const reconciler = testApp.app.get(ReportTargetReconciler);
    const flagged = await reconciler.reconcile();
    expect(flagged).toBeGreaterThanOrEqual(1);

    const queue = await request(httpServer(testApp))
      .get('/api/v1/admin/reports')
      .query({ status: 'open' })
      .set('Authorization', `Bearer ${admin.accessToken}`)
      .expect(200);
    const page = queue.body as AdminReportsPage;
    const found = page.items.find((item) => item.id === reportId);
    expect(found).toBeDefined();
    expect(found?.status).toBe('open');
    expect(found?.targetDeleted).toBe(true);
  });
});
