import { PropertyType } from '../../src/common/enums/property-type.enum.js';
import { PropertiesQueryService } from '../../src/modules/properties/properties.query.service.js';
import {
  FurnishedStatus,
  ListingType
} from '../../src/modules/properties/schemas/property.schema.js';
import {
  closeAuthTestApp,
  createAuthTestApp,
  issueSession,
  type AuthTestApp
} from '../helpers/auth-test-app.js';
import { seedArea, seedCity, seedProperty } from '../helpers/test-db.js';

describe('PropertiesQueryService (integration)', () => {
  let testApp: AuthTestApp;
  let service: PropertiesQueryService;
  let ownerId: string;
  let cityId: string;
  let areaId: string;

  beforeAll(async () => {
    testApp = await createAuthTestApp();
    service = testApp.app.get(PropertiesQueryService);
    const owner = await issueSession(testApp, 'u5550002005@test.local');
    ownerId = owner.user.id;
    cityId = (await seedCity(testApp.prisma, 'query-city')).id;
    areaId = (await seedArea(testApp.prisma, cityId, 'query-area')).id;

    await seedProperty(testApp.prisma, {
      ownerId,
      title: 'Newest Matching',
      propertyType: 'villa',
      listingType: 'sale',
      price: 200000,
      cityId,
      areaId,
      rooms: 3,
      furnished: 'furnished',
      createdAt: new Date('2026-05-26T12:00:00.000Z'),
      objectKeySuffix: 'newest-matching'
    });
    await seedProperty(testApp.prisma, {
      ownerId,
      title: 'Older Matching',
      propertyType: 'villa',
      listingType: 'sale',
      price: 150000,
      cityId,
      areaId,
      rooms: 3,
      furnished: 'furnished',
      createdAt: new Date('2026-05-26T11:00:00.000Z'),
      objectKeySuffix: 'older-matching'
    });
    await seedProperty(testApp.prisma, {
      ownerId,
      title: 'Wrong Rooms',
      propertyType: 'villa',
      listingType: 'sale',
      price: 175000,
      cityId,
      areaId,
      rooms: 2,
      furnished: 'furnished',
      createdAt: new Date('2026-05-26T10:00:00.000Z'),
      objectKeySuffix: 'wrong-rooms'
    });
  });

  afterAll(async () => {
    await closeAuthTestApp(testApp);
  });

  it('filters and orders the public feed', async () => {
    const page = await service.findFeed({
      limit: 10,
      propertyType: PropertyType.Villa,
      listingType: ListingType.Sale,
      minPrice: 100000,
      maxPrice: 250000,
      rooms: 3,
      furnished: FurnishedStatus.Furnished
    });

    expect(page.items.map((item) => item.title)).toEqual(['Newest Matching', 'Older Matching']);
  });
});
