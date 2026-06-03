import request from 'supertest';
import { adminSession } from '../helpers/admin-helpers.js';
import {
  closeAuthTestApp,
  createAuthTestApp,
  httpServer,
  type AuthTestApp
} from '../helpers/auth-test-app.js';

interface LocationBody {
  id: string;
  name: string;
  slug: string;
  type: 'City' | 'Area';
  parentId: string | null;
}

describe('admin locations (e2e)', () => {
  let testApp: AuthTestApp;

  beforeAll(async () => {
    testApp = await createAuthTestApp();
  });

  afterAll(async () => {
    await closeAuthTestApp(testApp);
  });

  it('creates city, then area, and both become filterable on public endpoints', async () => {
    const admin = await adminSession(testApp, 'u5553300001@test.local');

    const cityResp = await request(httpServer(testApp))
      .post('/api/v1/admin/locations/cities')
      .set('Authorization', `Bearer ${admin.accessToken}`)
      .send({ name: 'Atlantica', slug: 'atlantica' })
      .expect(201);
    const city = cityResp.body as LocationBody;
    expect(city.type).toBe('City');
    expect(city.slug).toBe('atlantica');

    const areaResp = await request(httpServer(testApp))
      .post('/api/v1/admin/locations/areas')
      .set('Authorization', `Bearer ${admin.accessToken}`)
      .send({ parentId: city.id, name: 'Coastal District', slug: 'coastal-district' })
      .expect(201);
    const area = areaResp.body as LocationBody;
    expect(area.type).toBe('Area');
    expect(area.parentId).toBe(city.id);

    // public /locations/cities lists Atlantica
    await request(httpServer(testApp))
      .get('/api/v1/locations/cities')
      .expect(200)
      .expect(({ body }) => {
        const items = body as Array<{ id: string; slug: string }>;
        expect(items.some((item) => item.slug === 'atlantica')).toBe(true);
      });

    // public /locations/cities/:cityId/areas lists the area
    await request(httpServer(testApp))
      .get(`/api/v1/locations/cities/${city.id}/areas`)
      .expect(200)
      .expect(({ body }) => {
        const items = body as Array<{ slug: string }>;
        expect(items.some((item) => item.slug === 'coastal-district')).toBe(true);
      });

    // duplicate slug returns 409
    await request(httpServer(testApp))
      .post('/api/v1/admin/locations/cities')
      .set('Authorization', `Bearer ${admin.accessToken}`)
      .send({ name: 'Atlantica', slug: 'atlantica' })
      .expect(409);

    // patch isActive=false hides from public list
    await request(httpServer(testApp))
      .patch(`/api/v1/admin/locations/${city.id}`)
      .set('Authorization', `Bearer ${admin.accessToken}`)
      .send({ isActive: false })
      .expect(200);
    await request(httpServer(testApp))
      .get('/api/v1/locations/cities')
      .expect(200)
      .expect(({ body }) => {
        const items = body as Array<{ slug: string }>;
        expect(items.some((item) => item.slug === 'atlantica')).toBe(false);
      });
  });
});
