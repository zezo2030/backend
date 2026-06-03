import { Role } from '@prisma/client';
import { FavoritesService } from '../../src/modules/favorites/favorites.service.js';
import { ModerationStatus } from '../../src/modules/properties/property.enums.js';
import { closeAuthTestApp, createAuthTestApp, type AuthTestApp } from '../helpers/auth-test-app.js';
import { seedArea, seedCity, seedProperty } from '../helpers/test-db.js';

describe('FavoritesService (integration)', () => {
  let testApp: AuthTestApp;
  let favorites: FavoritesService;
  let userId: string;
  let ownerId: string;

  beforeAll(async () => {
    testApp = await createAuthTestApp();
    favorites = testApp.app.get(FavoritesService);
    userId = (
      await testApp.prisma.user.create({
        data: { email: 'fav-user@test.local', displayName: 'Fav User', role: Role.RegularUser }
      })
    ).id;
    ownerId = (
      await testApp.prisma.user.create({
        data: {
          email: 'fav-owner@test.local',
          displayName: 'Fav Owner',
          role: Role.Broker,
          brokerProfile: { create: { officeName: 'Fav Office' } }
        }
      })
    ).id;
  });

  afterAll(async () => {
    await closeAuthTestApp(testApp);
  });

  it('favorite is idempotent and unfavorite removes the row', async () => {
    const propertyId = await seedPropertyForOwner('alpha');
    await favorites.favorite(userId, propertyId);
    await favorites.favorite(userId, propertyId);

    expect(
      await testApp.prisma.favorite.count({
        where: { userId, propertyId }
      })
    ).toBe(1);

    await favorites.unfavorite(userId, propertyId);
    expect(
      await testApp.prisma.favorite.count({
        where: { userId, propertyId }
      })
    ).toBe(0);
  });

  it('list returns favorites sorted newest first, filters non-visible properties, and paginates by cursor', async () => {
    const [first, second, third] = await Promise.all([
      seedPropertyForOwner('one'),
      seedPropertyForOwner('two'),
      seedPropertyForOwner('three')
    ]);

    const baseInstant = Date.parse('2026-05-26T00:00:00.000Z');
    await testApp.prisma.favorite.createMany({
      data: [
        { userId, propertyId: first, createdAt: new Date(baseInstant) },
        { userId, propertyId: second, createdAt: new Date(baseInstant + 1000) },
        { userId, propertyId: third, createdAt: new Date(baseInstant + 2000) }
      ]
    });

    await testApp.prisma.property.update({
      where: { id: second },
      data: { moderationStatus: ModerationStatus.pending_review }
    });

    const firstPage = await favorites.list(userId, undefined, 1);
    expect(firstPage.items.map((item) => item.id)).toEqual([third]);
    expect(firstPage.nextCursor).not.toBeNull();

    const secondPage = await favorites.list(userId, firstPage.nextCursor!, 10);
    expect(secondPage.items.map((item) => item.id)).toEqual([first]);
    expect(secondPage.nextCursor).toBeNull();
  });

  async function seedPropertyForOwner(suffix: string): Promise<string> {
    const city = await seedCity(testApp.prisma, `fav-city-${suffix}`);
    const area = await seedArea(testApp.prisma, city.id, `fav-area-${suffix}`);
    const created = await seedProperty(testApp.prisma, {
      ownerId,
      title: `Property ${suffix}`,
      propertyType: 'apartment',
      listingType: 'sale',
      price: 150000,
      cityId: city.id,
      areaId: area.id,
      rooms: 2,
      furnished: 'unfurnished',
      createdAt: new Date(),
      objectKeySuffix: suffix
    });
    return created.id;
  }
});
