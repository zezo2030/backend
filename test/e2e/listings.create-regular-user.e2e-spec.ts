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
}

interface FeedResponse {
  items: Array<{ id: string }>;
}

interface MineResponse {
  items: Array<{ id: string; moderationStatus: string }>;
  pageInfo: { page: number; pageSize: number; totalItems: number; totalPages: number };
}

describe('listings create — regular user (e2e)', () => {
  let testApp: AuthTestApp;

  beforeAll(async () => {
    testApp = await createAuthTestApp();
  });

  afterAll(async () => {
    await closeAuthTestApp(testApp);
  });

  it('regular user listing is active immediately, visible in feed and /mine', async () => {
    const session = await issueSession(testApp, 'u5550004002@test.local');
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

    const city = await seedCity(testApp.prisma, 'regular-listing-city');
    const area = await seedArea(testApp.prisma, city.id, 'regular-listing-area');
    const created = await request(httpServer(testApp))
      .post('/api/v1/properties')
      .set('Authorization', `Bearer ${session.accessToken}`)
      .send({
        title: 'RegularUser Listing',
        description: 'A studio downtown',
        propertyType: 'apartment',
        listingType: 'rent',
        price: 800,
        currency: 'USD',
        city: city.id,
        area: area.id,
        rooms: 1,
        bathrooms: 1,
        sizeSqm: 35,
        imageObjectKeys: [upload.objectKey]
      })
      .expect(201);
    const createdBody = created.body as PropertyResponse;
    expect(createdBody.moderationStatus).toBe('active');

    const feed = await request(httpServer(testApp)).get('/api/v1/properties').expect(200);
    expect((feed.body as FeedResponse).items.some((item) => item.id === createdBody.id)).toBe(
      true
    );

    const mine = await request(httpServer(testApp))
      .get('/api/v1/properties/mine')
      .set('Authorization', `Bearer ${session.accessToken}`)
      .expect(200);
    const mineBody = mine.body as MineResponse;
    expect(mineBody.items.some((item) => item.id === createdBody.id)).toBe(true);
    expect(mineBody.items.find((item) => item.id === createdBody.id)?.moderationStatus).toBe(
      'active'
    );
  });
});
