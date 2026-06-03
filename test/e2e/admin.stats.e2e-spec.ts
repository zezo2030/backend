import request from 'supertest';
import { Role } from '@prisma/client';
import { StatsService } from '../../src/modules/admin/stats.service.js';
import { adminSession, sessionWithRole } from '../helpers/admin-helpers.js';
import {
  closeAuthTestApp,
  createAuthTestApp,
  httpServer,
  type AuthTestApp
} from '../helpers/auth-test-app.js';
import { seedArea, seedCity, seedProperty } from '../helpers/test-db.js';
import { ModerationStatus } from '../../src/modules/properties/property.enums.js';

interface StatsBody {
  users: { total: number; byRole: Record<string, number> };
  properties: { total: number; byStatus: Record<string, number> };
  requests: { total: number; byStatus: Record<string, number> };
}

describe('admin stats (e2e)', () => {
  let testApp: AuthTestApp;

  beforeAll(async () => {
    testApp = await createAuthTestApp();
  });

  afterAll(async () => {
    await closeAuthTestApp(testApp);
  });

  it('returns counts that match raw collection counts', async () => {
    const admin = await adminSession(testApp, 'u5553400001@test.local');
    const broker = await sessionWithRole(testApp, 'u5553400002@test.local', 'Broker');
    await sessionWithRole(testApp, 'u5553400003@test.local', 'RegularUser');

    const city = await seedCity(testApp.prisma, 'admin-stats-city');
    const area = await seedArea(testApp.prisma, city.id, 'admin-stats-area');
    await seedProperty(testApp.prisma, {
      ownerId: broker.user.id,
      title: 'Stats Listing',
      propertyType: 'apartment',
      listingType: 'sale',
      price: 1000,
      city: city.id,
      area: area.id,
      rooms: 1,
      furnished: 'unfurnished',
      createdAt: new Date(),
      objectKeySuffix: 'stats-listing'
    });

    testApp.app.get(StatsService).invalidate();

    const resp = await request(httpServer(testApp))
      .get('/api/v1/admin/stats')
      .set('Authorization', `Bearer ${admin.accessToken}`)
      .expect(200);
    const stats = resp.body as StatsBody;

    const rawUserCount = await testApp.prisma.user.count({ where: { deletedAt: null } });
    const rawBrokerCount = await testApp.prisma.user.count({
      where: { deletedAt: null, role: Role.Broker }
    });
    const rawActiveProperties = await testApp.prisma.property.count({
      where: { moderationStatus: ModerationStatus.active, deletedAt: null }
    });

    expect(stats.users.total).toBe(rawUserCount);
    expect(stats.users.byRole.Broker).toBe(rawBrokerCount);
    expect(stats.users.byRole.Admin).toBeGreaterThanOrEqual(1);
    expect(stats.properties.byStatus.active).toBe(rawActiveProperties);
  });
});
