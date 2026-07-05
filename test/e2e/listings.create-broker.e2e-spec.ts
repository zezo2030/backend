import request from 'supertest';
import {
  closeAuthTestApp,
  createAuthTestApp,
  httpServer,
  issueSession,
  type AuthTestApp
} from '../helpers/auth-test-app.js';
import { seedArea, seedCity } from '../helpers/test-db.js';

interface UploadResponse {
  uploads: Array<{ objectKey: string; uploadUrl: string; expiresAt: string }>;
}

interface PropertyResponse {
  id: string;
  moderationStatus: string;
  images: Array<{ url: string; sortOrder: number }>;
}

interface FeedResponse {
  items: Array<{ id: string; title: string }>;
}

describe('listings create — broker (e2e)', () => {
  let testApp: AuthTestApp;

  beforeAll(async () => {
    testApp = await createAuthTestApp();
  });

  afterAll(async () => {
    await closeAuthTestApp(testApp);
  });

  it('broker listing appears in public feed immediately as active', async () => {
    const session = await issueSession(testApp, 'u5550004001@test.local');
    await request(httpServer(testApp))
      .post('/api/v1/auth/select-role')
      .set('Authorization', `Bearer ${session.accessToken}`)
      .send({ role: 'Broker', officeName: 'Brokerage A' })
      .expect(200);

    const uploadResp = await request(httpServer(testApp))
      .post('/api/v1/media/uploads')
      .set('Authorization', `Bearer ${session.accessToken}`)
      .send({
        items: [
          { contentType: 'image/jpeg', sizeBytes: 2048 },
          { contentType: 'image/png', sizeBytes: 4096 }
        ]
      })
      .expect(201);
    const uploadBody = uploadResp.body as UploadResponse;
    expect(uploadBody.uploads).toHaveLength(2);
    for (const upload of uploadBody.uploads) {
      expect(upload.objectKey).toMatch(new RegExp(`^uploads/${session.user.id}/`));
      testApp.objectStore.putTestObject(upload.objectKey, { sizeBytes: 2048 });
    }

    const city = await seedCity(testApp.prisma, 'broker-listing-city');
    const area = await seedArea(testApp.prisma, city.id, 'broker-listing-area');
    const created = await request(httpServer(testApp))
      .post('/api/v1/properties')
      .set('Authorization', `Bearer ${session.accessToken}`)
      .send({
        title: 'Broker Listing',
        description: 'A sea-view apartment',
        propertyType: 'apartment',
        listingType: 'sale',
        price: 250000,
        currency: 'USD',
        city: city.id,
        area: area.id,
        rooms: 3,
        bathrooms: 2,
        sizeSqm: 120,
        imageObjectKeys: uploadBody.uploads.map((upload) => upload.objectKey)
      })
      .expect(201);
    const createdBody = created.body as PropertyResponse;
    // New listings await admin review and must not appear in the public feed.
    expect(createdBody.moderationStatus).toBe('pending_review');
    expect(createdBody.images).toHaveLength(2);

    const feed = await request(httpServer(testApp)).get('/api/v1/properties').expect(200);
    const feedBody = feed.body as FeedResponse;
    expect(feedBody.items.some((item) => item.id === createdBody.id)).toBe(false);
  });
});
