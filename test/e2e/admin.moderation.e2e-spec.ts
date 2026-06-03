import request from 'supertest';
import { adminSession, sessionWithRole } from '../helpers/admin-helpers.js';
import {
  closeAuthTestApp,
  createAuthTestApp,
  httpServer,
  type AuthTestApp
} from '../helpers/auth-test-app.js';
import { seedArea, seedCity, seedProperty } from '../helpers/test-db.js';
import { ModerationStatus } from '../../src/modules/properties/property.enums.js';

describe('admin moderation (e2e)', () => {
  let testApp: AuthTestApp;

  beforeAll(async () => {
    testApp = await createAuthTestApp();
  });

  afterAll(async () => {
    await closeAuthTestApp(testApp);
  });

  async function seedListing(
    ownerId: string,
    status: 'pending_review' | 'active'
  ): Promise<string> {
    const city = await seedCity(testApp.prisma, `mod-city-${Date.now()}`);
    const area = await seedArea(testApp.prisma, city.id, `mod-area-${Date.now()}`);
    const created = await seedProperty(testApp.prisma, {
      ownerId,
      title: 'Pending Listing',
      propertyType: 'apartment',
      listingType: 'sale',
      price: 123000,
      cityId: city.id,
      areaId: area.id,
      rooms: 3,
      furnished: 'unfurnished',
      createdAt: new Date(),
      objectKeySuffix: `mod-${Date.now()}`
    });
    if (status !== 'active') {
      await testApp.prisma.property.update({
        where: { id: created.id },
        data: { moderationStatus: ModerationStatus.pending_review }
      });
    }
    return created.id;
  }

  it('approves a pending listing → appears in feed within 5s', async () => {
    const admin = await adminSession(testApp, 'u5553100001@test.local');
    const owner = await sessionWithRole(testApp, 'u5553100002@test.local', 'RegularUser');
    const listingId = await seedListing(owner.user.id, 'pending_review');

    await request(httpServer(testApp))
      .get('/api/v1/properties')
      .expect(200)
      .expect(({ body }) => {
        const items = (body as { items: Array<{ id: string }> }).items;
        expect(items.find((item) => item.id === listingId)).toBeUndefined();
      });

    const approvedAt = Date.now();
    await request(httpServer(testApp))
      .post(`/api/v1/admin/properties/${listingId}/moderation`)
      .set('Authorization', `Bearer ${admin.accessToken}`)
      .send({ action: 'approve' })
      .expect(200)
      .expect(({ body }) => {
        expect((body as { moderationStatus: string }).moderationStatus).toBe('active');
      });

    await request(httpServer(testApp))
      .get('/api/v1/properties')
      .expect(200)
      .expect(({ body }) => {
        const items = (body as { items: Array<{ id: string }> }).items;
        expect(items.find((item) => item.id === listingId)).toBeDefined();
      });
    expect(Date.now() - approvedAt).toBeLessThan(5000);
  });

  it('rejects with rejectionReason and excludes from feed', async () => {
    const admin = await adminSession(testApp, 'u5553100003@test.local');
    const owner = await sessionWithRole(testApp, 'u5553100004@test.local', 'RegularUser');
    const listingId = await seedListing(owner.user.id, 'pending_review');

    await request(httpServer(testApp))
      .post(`/api/v1/admin/properties/${listingId}/moderation`)
      .set('Authorization', `Bearer ${admin.accessToken}`)
      .send({ action: 'reject', reason: 'duplicate listing' })
      .expect(200)
      .expect(({ body }) => {
        const responseBody = body as { moderationStatus: string; rejectionReason: string };
        expect(responseBody.moderationStatus).toBe('rejected');
        expect(responseBody.rejectionReason).toBe('duplicate listing');
      });

    await request(httpServer(testApp))
      .get('/api/v1/properties')
      .expect(200)
      .expect(({ body }) => {
        const items = (body as { items: Array<{ id: string }> }).items;
        expect(items.find((item) => item.id === listingId)).toBeUndefined();
      });
  });

  it('reject without reason returns 422', async () => {
    const admin = await adminSession(testApp, 'u5553100005@test.local');
    const owner = await sessionWithRole(testApp, 'u5553100006@test.local', 'RegularUser');
    const listingId = await seedListing(owner.user.id, 'pending_review');

    await request(httpServer(testApp))
      .post(`/api/v1/admin/properties/${listingId}/moderation`)
      .set('Authorization', `Bearer ${admin.accessToken}`)
      .send({ action: 'reject' })
      .expect(422);
  });
});
