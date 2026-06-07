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
  images: Array<{ url: string; sortOrder: number }>;
  videos: Array<{ url: string; sortOrder: number }>;
}

describe('listings create with video (e2e)', () => {
  let testApp: AuthTestApp;

  beforeAll(async () => {
    testApp = await createAuthTestApp();
  });

  afterAll(async () => {
    await closeAuthTestApp(testApp);
  });

  async function brokerSession(email: string) {
    const session = await issueSession(testApp, email);
    await request(httpServer(testApp))
      .post('/api/v1/auth/select-role')
      .set('Authorization', `Bearer ${session.accessToken}`)
      .send({ role: 'Broker', officeName: 'Video Brokerage' })
      .expect(200);
    return session;
  }

  it('presigns a video upload and returns videos[] on the created listing', async () => {
    const session = await brokerSession('u5550009001@test.local');

    const uploadResp = await request(httpServer(testApp))
      .post('/api/v1/media/uploads')
      .set('Authorization', `Bearer ${session.accessToken}`)
      .send({
        items: [
          { contentType: 'image/jpeg', sizeBytes: 2048 },
          { contentType: 'video/mp4', sizeBytes: 4_194_304 }
        ]
      })
      .expect(201);
    const uploadBody = uploadResp.body as UploadResponse;
    const [imageKey, videoKey] = uploadBody.uploads.map((u) => u.objectKey);
    expect(videoKey).toMatch(/\.mp4$/);
    testApp.objectStore.putObject(imageKey, { contentType: 'image/jpeg', sizeBytes: 2048 });
    testApp.objectStore.putObject(videoKey, { contentType: 'video/mp4', sizeBytes: 4_194_304 });

    const city = await seedCity(testApp.prisma, 'video-city');
    const area = await seedArea(testApp.prisma, city.id, 'video-area');
    const created = await request(httpServer(testApp))
      .post('/api/v1/properties')
      .set('Authorization', `Bearer ${session.accessToken}`)
      .send({
        title: 'Listing with walkthrough video',
        description: 'A bright apartment with a video tour',
        propertyType: 'apartment',
        listingType: 'sale',
        price: 250000,
        currency: 'USD',
        city: city.id,
        area: area.id,
        rooms: 3,
        bathrooms: 2,
        sizeSqm: 120,
        imageObjectKeys: [imageKey],
        videoObjectKeys: [videoKey]
      })
      .expect(201);
    const body = created.body as PropertyResponse;
    expect(body.images).toHaveLength(1);
    expect(body.videos).toHaveLength(1);
    expect(body.videos[0]!.url).toBeTruthy();

    const detail = await request(httpServer(testApp))
      .get(`/api/v1/properties/${body.id}`)
      .expect(200);
    expect((detail.body as PropertyResponse).videos).toHaveLength(1);
  });

  it('rejects a non-video object supplied as a video (422)', async () => {
    const session = await brokerSession('u5550009002@test.local');
    // An object whose real content is an image, offered as a video key.
    const imposterKey = `uploads/${session.user.id}/imposter.mp4`;
    testApp.objectStore.putObject(imposterKey, { contentType: 'image/jpeg', sizeBytes: 2048 });
    const realImage = `uploads/${session.user.id}/cover.jpg`;
    testApp.objectStore.putObject(realImage, { contentType: 'image/jpeg', sizeBytes: 2048 });

    const city = await seedCity(testApp.prisma, 'video-reject-city');
    const area = await seedArea(testApp.prisma, city.id, 'video-reject-area');
    await request(httpServer(testApp))
      .post('/api/v1/properties')
      .set('Authorization', `Bearer ${session.accessToken}`)
      .send({
        title: 'Bad video listing',
        description: 'Should be rejected',
        propertyType: 'apartment',
        listingType: 'sale',
        price: 100000,
        currency: 'USD',
        city: city.id,
        area: area.id,
        rooms: 1,
        bathrooms: 1,
        sizeSqm: 60,
        imageObjectKeys: [realImage],
        videoObjectKeys: [imposterKey]
      })
      .expect(422);
  });
});
