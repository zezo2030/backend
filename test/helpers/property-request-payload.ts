import type { PrismaService } from '../../src/infra/prisma/prisma.service.js';
import { seedArea, seedCity } from './test-db.js';

export async function makePropertyRequestPayload(
  prisma: PrismaService,
  overrides: Record<string, unknown> = {}
) {
  const city = await seedCity(prisma, `city-${Date.now()}`);
  const area = await seedArea(prisma, city.id, `area-${Date.now()}`);
  return {
    title: 'Need a family villa',
    description: 'Looking for a quiet villa near schools.',
    propertyType: 'villa',
    requestType: 'buy',
    cityId: city.id,
    areaId: area.id,
    minPrice: 100000,
    maxPrice: 300000,
    currency: 'USD',
    requiredRooms: 4,
    approxSizeSqm: 200,
    isUrgent: true,
    contactMethod: 'whatsapp',
    ...overrides
  };
}
