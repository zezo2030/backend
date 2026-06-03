import { LocationType, PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function upsertCity(name: string, slug: string) {
  const existing = await prisma.location.findFirst({
    where: { type: LocationType.City, slug, parentId: null }
  });
  if (existing) {
    return prisma.location.update({
      where: { id: existing.id },
      data: { name, isActive: true }
    });
  }
  return prisma.location.create({
    data: { name, slug, type: LocationType.City, isActive: true }
  });
}

async function upsertArea(cityId: string, name: string, slug: string) {
  const existing = await prisma.location.findFirst({
    where: { type: LocationType.Area, slug, parentId: cityId }
  });
  if (existing) {
    return prisma.location.update({
      where: { id: existing.id },
      data: { name, isActive: true }
    });
  }
  return prisma.location.create({
    data: { name, slug, type: LocationType.Area, parentId: cityId, isActive: true }
  });
}

async function main(): Promise<void> {
  const cairo = await upsertCity('Cairo', 'cairo');
  await upsertArea(cairo.id, 'Cairo Downtown', 'downtown');

  const alex = await upsertCity('Alexandria', 'alexandria');
  await upsertArea(alex.id, 'Alexandria Downtown', 'downtown');

  console.log('Locations seeded');
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
