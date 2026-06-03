import request from 'supertest';
import {
  closeAuthTestApp,
  createAuthTestApp,
  httpServer,
  issueSession,
  type AuthTestApp
} from '../helpers/auth-test-app.js';
import { seedArea, seedCity, seedProperty } from '../helpers/test-db.js';
import { AvailabilityStatus } from '../../src/modules/properties/property.enums.js';

interface PropertyDetailBody {
  availabilityStatus: string;
  viewsCount: number;
  owner: {
    officeName: string | null;
    phone?: string;
    email?: string;
  };
}

describe('properties detail (e2e)', () => {
  let testApp: AuthTestApp;
  let propertyId: string;

  beforeAll(async () => {
    testApp = await createAuthTestApp();
    const owner = await issueSession(testApp, 'u5550002002@test.local');
    await request(httpServer(testApp))
      .post('/api/v1/auth/select-role')
      .set('Authorization', `Bearer ${owner.accessToken}`)
      .send({ role: 'Agency', officeName: 'Detail Agency' })
      .expect(200);

    const city = await seedCity(testApp.prisma, 'detail-city');
    const area = await seedArea(testApp.prisma, city.id, 'detail-area');
    const created = await seedProperty(testApp.prisma, {
      ownerId: owner.user.id,
      title: 'Rented Downtown Flat',
      propertyType: 'apartment',
      listingType: 'rent',
      price: 1200,
      city: city.id,
      area: area.id,
      rooms: 2,
      furnished: 'furnished',
      createdAt: new Date(),
      objectKeySuffix: 'detail'
    });
    propertyId = created.id;
    await testApp.prisma.property.update({
      where: { id: propertyId },
      data: { availabilityStatus: AvailabilityStatus.rented, viewsCount: 2 }
    });
  });

  afterAll(async () => {
    await closeAuthTestApp(testApp);
  });

  it('increments viewsCount and returns status-badged listings by id', async () => {
    await request(httpServer(testApp))
      .get(`/api/v1/properties/${propertyId}`)
      .expect(200)
      .expect(({ body }) => {
        const responseBody = body as PropertyDetailBody;
        expect(responseBody.availabilityStatus).toBe('rented');
        expect(responseBody.viewsCount).toBe(3);
        expect(responseBody.owner.officeName).toBe('Detail Agency');
        expect(responseBody.owner.phone).toBeUndefined();
        expect(responseBody.owner.email).toBeUndefined();
      });

    const stored = await testApp.prisma.property.findUnique({ where: { id: propertyId } });
    expect(stored?.viewsCount).toBe(3);
  });
});
