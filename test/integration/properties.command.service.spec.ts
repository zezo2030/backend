import {
  ForbiddenException,
  NotFoundException,
  UnprocessableEntityException
} from '@nestjs/common';
import request from 'supertest';
import { Role } from '../../src/common/enums/role.enum.js';
import { PropertyType } from '../../src/common/enums/property-type.enum.js';
import { PropertiesCommandService } from '../../src/modules/properties/properties.command.service.js';
import {
  AvailabilityStatus,
  ListingType,
  ModerationStatus
} from '../../src/modules/properties/schemas/property.schema.js';
import {
  closeAuthTestApp,
  createAuthTestApp,
  httpServer,
  issueSession,
  type AuthTestApp
} from '../helpers/auth-test-app.js';
import { seedArea, seedCity } from '../helpers/test-db.js';

interface SeedSessionOptions {
  email: string;
  role: Role;
  officeName?: string;
}

describe('PropertiesCommandService (integration)', () => {
  let testApp: AuthTestApp;
  let service: PropertiesCommandService;

  beforeAll(async () => {
    testApp = await createAuthTestApp();
    service = testApp.app.get(PropertiesCommandService);
  });

  afterAll(async () => {
    await closeAuthTestApp(testApp);
  });

  it('creates broker listing as active and rejects when uploads are missing', async () => {
    const broker = await seedSession({
      email: 'u5550005001@test.local',
      role: Role.Broker,
      officeName: 'Brokerage'
    });
    const city = await seedCity(testApp.prisma, 'cmd-city-1');
    const area = await seedArea(testApp.prisma, city.id, 'cmd-area-1');
    const objectKey = `uploads/${broker.userId}/img-1.jpg`;
    testApp.objectStore.putObject(objectKey, { contentType: 'image/jpeg', sizeBytes: 2048 });

    const created = await service.create(
      {
        title: 'Sea View',
        description: 'Apartment with sea view',
        propertyType: PropertyType.Apartment,
        listingType: ListingType.Sale,
        price: 200000,
        currency: 'USD',
        city: city.id,
        area: area.id,
        rooms: 3,
        bathrooms: 2,
        sizeSqm: 120,
        imageObjectKeys: [objectKey]
      },
      broker.userId
    );
    expect(created.moderationStatus).toBe(ModerationStatus.Active);

    const city2 = await seedCity(testApp.prisma, 'cmd-city-2');
    const area2 = await seedArea(testApp.prisma, city2.id, 'cmd-area-2');
    await expect(
      service.create(
        {
          title: 'Phantom',
          description: 'No images uploaded',
          propertyType: PropertyType.Apartment,
          listingType: ListingType.Sale,
          price: 100000,
          currency: 'USD',
          city: city2.id,
          area: area2.id,
          rooms: 2,
          bathrooms: 1,
          sizeSqm: 60,
          imageObjectKeys: [`uploads/${broker.userId}/missing.jpg`]
        },
        broker.userId
      )
    ).rejects.toBeInstanceOf(UnprocessableEntityException);
  });

  it('creates regular-user listing as active and keeps active on moderation-relevant edits', async () => {
    const user = await seedSession({ email: 'u5550005002@test.local', role: Role.RegularUser });
    const city = await seedCity(testApp.prisma, 'cmd-city-3');
    const area = await seedArea(testApp.prisma, city.id, 'cmd-area-3');
    const objectKey = `uploads/${user.userId}/img-1.jpg`;
    testApp.objectStore.putObject(objectKey);

    const created = await service.create(
      {
        title: 'Original',
        description: 'Original description',
        propertyType: PropertyType.Apartment,
        listingType: ListingType.Rent,
        price: 700,
        currency: 'USD',
        city: city.id,
        area: area.id,
        rooms: 1,
        bathrooms: 1,
        sizeSqm: 30,
        imageObjectKeys: [objectKey]
      },
      user.userId
    );
    expect(created.moderationStatus).toBe(ModerationStatus.Active);

    const editedNonModeration = await service.update(created.id, { bathrooms: 2 }, user.userId);
    expect(editedNonModeration.moderationStatus).toBe(ModerationStatus.Active);

    const editedModeration = await service.update(
      created.id,
      { title: 'Updated Title' },
      user.userId
    );
    expect(editedModeration.moderationStatus).toBe(ModerationStatus.Active);
  });

  it('transitions availability and soft-deletes; rejects non-owner non-admin edits', async () => {
    const broker = await seedSession({
      email: 'u5550005003@test.local',
      role: Role.Broker,
      officeName: 'Brokerage'
    });
    const other = await seedSession({ email: 'u5550005004@test.local', role: Role.RegularUser });
    const city = await seedCity(testApp.prisma, 'cmd-city-4');
    const area = await seedArea(testApp.prisma, city.id, 'cmd-area-4');
    const objectKey = `uploads/${broker.userId}/img-1.jpg`;
    testApp.objectStore.putObject(objectKey);

    const created = await service.create(
      {
        title: 'Lifecycle',
        description: 'Lifecycle test',
        propertyType: PropertyType.Apartment,
        listingType: ListingType.Rent,
        price: 1500,
        currency: 'USD',
        city: city.id,
        area: area.id,
        rooms: 2,
        bathrooms: 1,
        sizeSqm: 70,
        imageObjectKeys: [objectKey]
      },
      broker.userId
    );

    await expect(
      service.update(created.id, { title: 'Hijack' }, other.userId)
    ).rejects.toBeInstanceOf(ForbiddenException);

    const rented = await service.updateAvailability(
      created.id,
      { availabilityStatus: AvailabilityStatus.Rented },
      broker.userId
    );
    expect(rented.availabilityStatus).toBe(AvailabilityStatus.Rented);

    await service.softDelete(created.id, broker.userId);

    await expect(
      service.update(created.id, { title: 'Edit after delete' }, broker.userId)
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  async function seedSession(options: SeedSessionOptions): Promise<{ userId: string }> {
    const session = await issueSession(testApp, options.email);
    await request(httpServer(testApp))
      .post('/api/v1/auth/select-role')
      .set('Authorization', `Bearer ${session.accessToken}`)
      .send(
        options.role === Role.RegularUser
          ? { role: options.role }
          : { role: options.role, officeName: options.officeName ?? 'Office' }
      )
      .expect(200);
    return { userId: session.user.id };
  }
});
