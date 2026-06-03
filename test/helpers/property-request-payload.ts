import type { PrismaService } from '../../src/infra/prisma/prisma.service.js';

export async function makePropertyRequestPayload(
  _prisma: PrismaService,
  overrides: Record<string, unknown> = {}
) {
  // City/area are free text now (no Location foreign keys). A unique-ish suffix
  // keeps city-based filter assertions isolated across tests.
  const suffix = `${Date.now()}-${Math.floor(Math.random() * 1e6)}`;
  return {
    title: 'Need a family villa',
    description: 'Looking for a quiet villa near schools.',
    propertyType: 'villa',
    requestType: 'buy',
    city: `city-${suffix}`,
    area: `area-${suffix}`,
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
