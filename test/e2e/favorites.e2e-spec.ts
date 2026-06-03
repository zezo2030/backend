import request from 'supertest';
import {
  closeAuthTestApp,
  createAuthTestApp,
  httpServer,
  issueSession,
  type AuthTestApp
} from '../helpers/auth-test-app.js';
import { seedArea, seedCity, seedProperty } from '../helpers/test-db.js';

interface FavoriteSummaryBody {
  id: string;
  title: string;
  primaryImageUrl: string | null;
}

interface FavoritesPageBody {
  items: FavoriteSummaryBody[];
  nextCursor: string | null;
}

describe('favorites (e2e)', () => {
  let testApp: AuthTestApp;
  let userToken: string;
  let userId: string;
  let propertyId: string;

  beforeAll(async () => {
    testApp = await createAuthTestApp();
    const user = await sessionWithRole('u5553000001@test.local', 'RegularUser');
    userToken = user.accessToken;
    userId = user.user.id;
    const owner = await sessionWithRole('u5553000002@test.local', 'Broker');
    propertyId = await seedPropertyForOwner(owner.user.id, 'villa-favorite', 'Favorite Villa');
  });

  afterAll(async () => {
    await closeAuthTestApp(testApp);
  });

  it('PUT then GET then DELETE round trip works and PUT is idempotent', async () => {
    await request(httpServer(testApp))
      .put(`/api/v1/favorites/${propertyId}`)
      .set('Authorization', `Bearer ${userToken}`)
      .expect(204);

    await request(httpServer(testApp))
      .put(`/api/v1/favorites/${propertyId}`)
      .set('Authorization', `Bearer ${userToken}`)
      .expect(204);

    expect(
      await testApp.prisma.favorite.count({
        where: { userId, propertyId }
      })
    ).toBe(1);

    const listResponse = await request(httpServer(testApp))
      .get('/api/v1/favorites')
      .set('Authorization', `Bearer ${userToken}`)
      .expect(200);
    const listBody = listResponse.body as FavoritesPageBody;
    expect(listBody.items).toHaveLength(1);
    expect(listBody.items[0]?.id).toBe(propertyId);
    expect(listBody.items[0]?.title).toBe('Favorite Villa');

    await request(httpServer(testApp))
      .delete(`/api/v1/favorites/${propertyId}`)
      .set('Authorization', `Bearer ${userToken}`)
      .expect(204);

    expect(await testApp.prisma.favorite.count({ where: { userId } })).toBe(0);
  });

  it('rejects unauthenticated callers', async () => {
    await request(httpServer(testApp)).get('/api/v1/favorites').expect(401);
    await request(httpServer(testApp)).put(`/api/v1/favorites/${propertyId}`).expect(401);
  });

  async function sessionWithRole(email: string, role: 'RegularUser' | 'Broker' | 'Agency') {
    const first = await issueSession(testApp, email);
    await request(httpServer(testApp))
      .post('/api/v1/auth/select-role')
      .set('Authorization', `Bearer ${first.accessToken}`)
      .send({ role, officeName: `${role} Office` });
    return issueSession(testApp, email);
  }

  async function seedPropertyForOwner(
    ownerId: string,
    objectKeySuffix: string,
    title: string
  ): Promise<string> {
    const city = await seedCity(testApp.prisma, `fav-e2e-city-${objectKeySuffix}`);
    const area = await seedArea(testApp.prisma, city.id, `fav-e2e-area-${objectKeySuffix}`);
    const created = await seedProperty(testApp.prisma, {
      ownerId,
      title,
      propertyType: 'villa',
      listingType: 'sale',
      price: 250000,
      cityId: city.id,
      areaId: area.id,
      rooms: 4,
      furnished: 'furnished',
      createdAt: new Date(),
      objectKeySuffix
    });
    return created.id;
  }
});
