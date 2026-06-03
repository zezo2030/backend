import request from 'supertest';
import {
  closeAuthTestApp,
  createAuthTestApp,
  httpServer,
  issueSession,
  type AuthTestApp
} from '../helpers/auth-test-app.js';

interface UploadResponse {
  uploads: Array<{ objectKey: string; uploadUrl: string; expiresAt: string }>;
}

interface ErrorResponse {
  code?: string;
  message?: string;
}

describe('media presign (e2e)', () => {
  let testApp: AuthTestApp;
  const presignTtlSec = 60;

  beforeAll(async () => {
    testApp = await createAuthTestApp({ presignTtlSec });
  });

  afterAll(async () => {
    await closeAuthTestApp(testApp);
  });

  it('returns presigned URLs scoped to the caller user prefix and a TTL-bounded expiresAt', async () => {
    const session = await issueSession(testApp, 'u5550004006@test.local');
    await request(httpServer(testApp))
      .post('/api/v1/auth/select-role')
      .set('Authorization', `Bearer ${session.accessToken}`)
      .send({ role: 'Broker', officeName: 'Brokerage E' })
      .expect(200);

    const issuedAt = Date.now();
    const response = await request(httpServer(testApp))
      .post('/api/v1/media/uploads')
      .set('Authorization', `Bearer ${session.accessToken}`)
      .send({
        items: [
          { contentType: 'image/jpeg', sizeBytes: 1024 },
          { contentType: 'image/webp', sizeBytes: 2048 }
        ]
      })
      .expect(201);

    const body = response.body as UploadResponse;
    expect(body.uploads).toHaveLength(2);
    for (const upload of body.uploads) {
      expect(upload.objectKey).toMatch(new RegExp(`^uploads/${session.user.id}/`));
      expect(upload.uploadUrl).toMatch(/^https?:\/\//);
      const expiresMs = new Date(upload.expiresAt).getTime();
      expect(expiresMs).toBeGreaterThan(issuedAt);
      expect(expiresMs).toBeLessThanOrEqual(issuedAt + (presignTtlSec + 5) * 1000);
    }
    expect(testApp.objectStore.presignedRequests).toHaveLength(2);
    expect(testApp.objectStore.presignedRequests[0]?.ttlSeconds).toBe(presignTtlSec);
  });

  it('rejects oversized uploads with 422', async () => {
    const session = await issueSession(testApp, 'u5550004007@test.local');
    await request(httpServer(testApp))
      .post('/api/v1/auth/select-role')
      .set('Authorization', `Bearer ${session.accessToken}`)
      .send({ role: 'Broker', officeName: 'Brokerage F' })
      .expect(200);

    const response = await request(httpServer(testApp))
      .post('/api/v1/media/uploads')
      .set('Authorization', `Bearer ${session.accessToken}`)
      .send({ items: [{ contentType: 'image/jpeg', sizeBytes: 9_000_000 }] })
      .expect(422);
    expect((response.body as ErrorResponse).code).toBe('imageTooLarge');
  });

  it('rejects disallowed content types', async () => {
    const session = await issueSession(testApp, 'u5550004008@test.local');
    await request(httpServer(testApp))
      .post('/api/v1/auth/select-role')
      .set('Authorization', `Bearer ${session.accessToken}`)
      .send({ role: 'Broker', officeName: 'Brokerage G' })
      .expect(200);

    await request(httpServer(testApp))
      .post('/api/v1/media/uploads')
      .set('Authorization', `Bearer ${session.accessToken}`)
      .send({ items: [{ contentType: 'application/pdf', sizeBytes: 1024 }] })
      .expect(400);
  });
});
