import request from 'supertest';
import {
  closeAuthTestApp,
  createAuthTestApp,
  httpServer,
  issueSession,
  type AuthTestApp
} from '../helpers/auth-test-app.js';
import { ModerationStatus } from '../../src/modules/properties/property.enums.js';
import { seedArea, seedCity } from '../helpers/test-db.js';

interface UploadResponse {
  uploads: Array<{ objectKey: string }>;
}

interface PropertyResponse {
  id: string;
  title: string;
  availabilityStatus: string;
  moderationStatus: string;
}

interface FeedResponse {
  items: Array<{ id: string }>;
}

describe('listings owner edit/status/delete (e2e)', () => {
  let testApp: AuthTestApp;

  beforeAll(async () => {
    testApp = await createAuthTestApp();
  });

  afterAll(async () => {
    await closeAuthTestApp(testApp);
  });

  it('owner can edit, change availability, and delete with feed visibility transitions', async () => {
    const session = await issueSession(testApp, 'u5550004004@test.local');
    await request(httpServer(testApp))
      .post('/api/v1/auth/select-role')
      .set('Authorization', `Bearer ${session.accessToken}`)
      .send({ role: 'Broker', officeName: 'Brokerage D' })
      .expect(200);

    const uploadResp = await request(httpServer(testApp))
      .post('/api/v1/media/uploads')
      .set('Authorization', `Bearer ${session.accessToken}`)
      .send({ items: [{ contentType: 'image/jpeg', sizeBytes: 2048 }] })
      .expect(201);
    const upload = (uploadResp.body as UploadResponse).uploads[0]!;
    testApp.objectStore.putObject(upload.objectKey);

    const city = await seedCity(testApp.prisma, 'owner-edit-city');
    const area = await seedArea(testApp.prisma, city.id, 'owner-edit-area');
    const created = await request(httpServer(testApp))
      .post('/api/v1/properties')
      .set('Authorization', `Bearer ${session.accessToken}`)
      .send({
        title: 'Original Title',
        description: 'Original description',
        propertyType: 'apartment',
        listingType: 'rent',
        price: 1000,
        currency: 'USD',
        cityId: city.id,
        areaId: area.id,
        rooms: 2,
        bathrooms: 1,
        sizeSqm: 60,
        imageObjectKeys: [upload.objectKey]
      })
      .expect(201);
    const propertyId = (created.body as PropertyResponse).id;

    const edited = await request(httpServer(testApp))
      .patch(`/api/v1/properties/${propertyId}`)
      .set('Authorization', `Bearer ${session.accessToken}`)
      .send({ title: 'Edited Title' })
      .expect(200);
    expect((edited.body as PropertyResponse).title).toBe('Edited Title');
    expect((edited.body as PropertyResponse).moderationStatus).toBe('active');

    const statusResp = await request(httpServer(testApp))
      .patch(`/api/v1/properties/${propertyId}/status`)
      .set('Authorization', `Bearer ${session.accessToken}`)
      .send({ availabilityStatus: 'rented' })
      .expect(200);
    expect((statusResp.body as PropertyResponse).availabilityStatus).toBe('rented');

    const feedAfterRented = await request(httpServer(testApp))
      .get('/api/v1/properties')
      .expect(200);
    expect(
      (feedAfterRented.body as FeedResponse).items.some((item) => item.id === propertyId)
    ).toBe(false);

    const stillVisibleByDetail = await request(httpServer(testApp))
      .get(`/api/v1/properties/${propertyId}`)
      .expect(200);
    expect((stillVisibleByDetail.body as PropertyResponse).availabilityStatus).toBe('rented');

    await request(httpServer(testApp))
      .delete(`/api/v1/properties/${propertyId}`)
      .set('Authorization', `Bearer ${session.accessToken}`)
      .expect(204);

    const deletedDoc = await testApp.prisma.property.findUnique({ where: { id: propertyId } });
    expect(deletedDoc?.deletedAt).toBeInstanceOf(Date);
  });

  it('regular-user edits to moderation-relevant fields revert to pending_review', async () => {
    const session = await issueSession(testApp, 'u5550004005@test.local');
    await request(httpServer(testApp))
      .post('/api/v1/auth/select-role')
      .set('Authorization', `Bearer ${session.accessToken}`)
      .send({ role: 'RegularUser' })
      .expect(200);

    const uploadResp = await request(httpServer(testApp))
      .post('/api/v1/media/uploads')
      .set('Authorization', `Bearer ${session.accessToken}`)
      .send({ items: [{ contentType: 'image/jpeg', sizeBytes: 2048 }] })
      .expect(201);
    const upload = (uploadResp.body as UploadResponse).uploads[0]!;
    testApp.objectStore.putObject(upload.objectKey);

    const city = await seedCity(testApp.prisma, 'user-edit-city');
    const area = await seedArea(testApp.prisma, city.id, 'user-edit-area');
    const created = await request(httpServer(testApp))
      .post('/api/v1/properties')
      .set('Authorization', `Bearer ${session.accessToken}`)
      .send({
        title: 'User Listing',
        description: 'User description',
        propertyType: 'apartment',
        listingType: 'sale',
        price: 90000,
        currency: 'USD',
        cityId: city.id,
        areaId: area.id,
        rooms: 2,
        bathrooms: 1,
        sizeSqm: 50,
        imageObjectKeys: [upload.objectKey]
      })
      .expect(201);
    const propertyId = (created.body as PropertyResponse).id;

    await testApp.prisma.property.update({
      where: { id: propertyId },
      data: { moderationStatus: ModerationStatus.active }
    });

    const edited = await request(httpServer(testApp))
      .patch(`/api/v1/properties/${propertyId}`)
      .set('Authorization', `Bearer ${session.accessToken}`)
      .send({ title: 'Suspicious New Title' })
      .expect(200);
    expect((edited.body as PropertyResponse).moderationStatus).toBe('pending_review');
  });
});
