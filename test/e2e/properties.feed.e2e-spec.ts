import request from 'supertest';
import {
  closeAuthTestApp,
  createAuthTestApp,
  httpServer,
  issueSession,
  type AuthTestApp
} from '../helpers/auth-test-app.js';
import { seedArea, seedCity, seedProperty } from '../helpers/test-db.js';

interface PropertySummaryBody {
  title: string;
  primaryImageUrl: string | null;
}

interface FeedBody {
  items: PropertySummaryBody[];
  nextCursor: string | null;
}

describe('properties feed (e2e)', () => {
  let testApp: AuthTestApp;
  let ownerId: string;
  let cityA: string;
  let cityB: string;
  let areaA: string;
  let areaB: string;

  beforeAll(async () => {
    testApp = await createAuthTestApp();
    const owner = await issueSession(testApp, 'u5550002001@test.local');
    await request(httpServer(testApp))
      .post('/api/v1/auth/select-role')
      .set('Authorization', `Bearer ${owner.accessToken}`)
      .send({ role: 'Broker', officeName: 'Feed Realty' })
      .expect(200);

    ownerId = owner.user.id;
    cityA = (await seedCity(testApp.prisma, 'feed-city-a')).id;
    cityB = (await seedCity(testApp.prisma, 'feed-city-b')).id;
    areaA = (await seedArea(testApp.prisma, cityA, 'feed-area-a')).id;
    areaB = (await seedArea(testApp.prisma, cityB, 'feed-area-b')).id;

    await seedProperty(testApp.prisma, {
      ownerId,
      title: 'Villa Sale',
      propertyType: 'villa',
      listingType: 'sale',
      price: 300000,
      city: cityA,
      area: areaA,
      rooms: 4,
      furnished: 'furnished',
      createdAt: new Date('2026-05-26T10:00:00.000Z'),
      objectKeySuffix: 'villa-sale'
    });
    await seedProperty(testApp.prisma, {
      ownerId,
      title: 'Apartment Rent',
      propertyType: 'apartment',
      listingType: 'rent',
      price: 900,
      city: cityA,
      area: areaB,
      rooms: 2,
      furnished: 'unfurnished',
      createdAt: new Date('2026-05-26T09:00:00.000Z'),
      objectKeySuffix: 'apartment-rent'
    });
    await seedProperty(testApp.prisma, {
      ownerId,
      title: 'Shop Sale',
      propertyType: 'shop',
      listingType: 'sale',
      price: 100000,
      city: cityB,
      area: areaB,
      rooms: 0,
      furnished: 'partially',
      createdAt: new Date('2026-05-26T08:00:00.000Z'),
      objectKeySuffix: 'shop-sale'
    });
  });

  afterAll(async () => {
    await closeAuthTestApp(testApp);
  });

  it('returns public feed results for documented filters', async () => {
    await request(httpServer(testApp))
      .get('/api/v1/properties')
      .query({
        city: cityA,
        area: areaA,
        propertyType: 'villa',
        listingType: 'sale',
        minPrice: 250000,
        maxPrice: 350000,
        rooms: 4,
        furnished: 'furnished'
      })
      .expect(200)
      .expect(({ body }) => {
        const responseBody = body as FeedBody;
        expect(responseBody.items).toHaveLength(1);
        expect(responseBody.items[0]?.title).toBe('Villa Sale');
        expect(responseBody.items[0]?.primaryImageUrl).toContain('/properties/villa-sale.jpg');
      });
  });

  it('keeps cursor pagination stable across newer inserts', async () => {
    const firstPage = await request(httpServer(testApp))
      .get('/api/v1/properties')
      .query({ limit: 2 })
      .expect(200);
    const firstPageBody = firstPage.body as FeedBody;

    expect(firstPageBody.items.map((item) => item.title)).toEqual(['Villa Sale', 'Apartment Rent']);
    expect(firstPageBody.nextCursor).toEqual(expect.any(String));

    await seedProperty(testApp.prisma, {
      ownerId,
      title: 'Newest After Cursor',
      propertyType: 'villa',
      listingType: 'sale',
      price: 500000,
      city: cityA,
      area: areaA,
      rooms: 5,
      furnished: 'furnished',
      createdAt: new Date('2026-05-26T11:00:00.000Z'),
      objectKeySuffix: 'newest-after-cursor'
    });

    await request(httpServer(testApp))
      .get('/api/v1/properties')
      .query({ limit: 2, cursor: firstPageBody.nextCursor })
      .expect(200)
      .expect(({ body }) => {
        const responseBody = body as FeedBody;
        expect(responseBody.items.map((item) => item.title)).toEqual(['Shop Sale']);
      });
  });
});
