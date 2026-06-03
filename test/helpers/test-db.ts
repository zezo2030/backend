import type { Prisma } from '@prisma/client';
import { PrismaService } from '../../src/infra/prisma/prisma.service.js';
import { toDecimal } from '../../src/common/prisma/decimal.util.js';
import {
  AvailabilityStatus,
  ModerationStatus
} from '../../src/modules/properties/property.enums.js';
import { LocationType } from '../../src/modules/locations/location.enums.js';

export async function truncateAllTables(prisma: PrismaService): Promise<void> {
  await prisma.$executeRawUnsafe(`
    TRUNCATE TABLE
      audit_events,
      broadcast_outbox,
      fanout_outbox,
      notifications,
      device_tokens,
      favorites,
      reports,
      property_images,
      properties,
      property_requests,
      refresh_tokens,
      broker_profiles,
      agency_profiles,
      users,
      locations
    RESTART IDENTITY CASCADE
  `);
}

export async function seedCity(
  prisma: PrismaService,
  slug: string,
  name = slug
): Promise<{ id: string }> {
  return prisma.location.create({
    data: { name, slug, type: LocationType.City, parentId: null, isActive: true }
  });
}

export async function seedArea(
  prisma: PrismaService,
  cityId: string,
  slug: string,
  name = slug
): Promise<{ id: string }> {
  return prisma.location.create({
    data: { name, slug, type: LocationType.Area, parentId: cityId, isActive: true }
  });
}

export interface SeedPropertyInput {
  ownerId: string;
  title: string;
  propertyType: string;
  listingType: string;
  price: number;
  cityId: string;
  areaId: string;
  rooms: number;
  furnished: string;
  createdAt: Date;
  objectKeySuffix: string;
}

export async function seedProperty(
  prisma: PrismaService,
  input: SeedPropertyInput
): Promise<{ id: string }> {
  const created = await prisma.property.create({
    data: {
      ownerId: input.ownerId,
      title: input.title,
      description: `${input.title} description`,
      propertyType: input.propertyType as Prisma.PropertyCreateInput['propertyType'],
      listingType: input.listingType as Prisma.PropertyCreateInput['listingType'],
      price: toDecimal(input.price),
      currency: 'USD',
      cityId: input.cityId,
      areaId: input.areaId,
      rooms: input.rooms,
      bathrooms: 2,
      sizeSqm: 150,
      floor: null,
      finishing: 'finished',
      furnished: input.furnished as Prisma.PropertyCreateInput['furnished'],
      moderationStatus: ModerationStatus.active,
      availabilityStatus: AvailabilityStatus.available,
      rejectionReason: null,
      viewsCount: 0,
      ownerIsActive: true,
      deletedAt: null,
      createdAt: input.createdAt,
      updatedAt: input.createdAt,
      images: {
        create: [
          {
            objectKey: `properties/${input.objectKeySuffix}.jpg`,
            contentType: 'image/jpeg',
            sizeBytes: 1000,
            sortOrder: 0,
            uploadedAt: input.createdAt
          }
        ]
      }
    }
  });
  return { id: created.id };
}
