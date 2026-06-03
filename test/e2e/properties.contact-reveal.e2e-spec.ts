import request from 'supertest';
import {
  closeAuthTestApp,
  createAuthTestApp,
  httpServer,
  issueSession,
  type AuthTestApp
} from '../helpers/auth-test-app.js';
import { seedArea, seedCity, seedProperty } from '../helpers/test-db.js';

interface ContactInfoBody {
  email: string;
  phone: string | null;
  whatsappUrl: string | null;
}

describe('properties contact reveal (e2e)', () => {
  let testApp: AuthTestApp;
  let propertyId: string;
  let accessToken: string;

  beforeAll(async () => {
    testApp = await createAuthTestApp();
    const owner = await issueSession(testApp, 'u5550002003@test.local');
    const caller = await issueSession(testApp, 'u5550002004@test.local');
    accessToken = caller.accessToken;

    await testApp.prisma.user.update({
      where: { id: owner.user.id },
      data: { phone: '+15550002003' }
    });

    const city = await seedCity(testApp.prisma, 'contact-city');
    const area = await seedArea(testApp.prisma, city.id, 'contact-area');
    const created = await seedProperty(testApp.prisma, {
      ownerId: owner.user.id,
      title: 'Contact Safe Listing',
      propertyType: 'villa',
      listingType: 'sale',
      price: 450000,
      cityId: city.id,
      areaId: area.id,
      rooms: 5,
      furnished: 'furnished',
      createdAt: new Date(),
      objectKeySuffix: 'contact'
    });
    propertyId = created.id;
  });

  afterAll(async () => {
    await closeAuthTestApp(testApp);
  });

  it('requires auth, returns contact info for authed callers, and writes an audit event', async () => {
    await request(httpServer(testApp))
      .get(`/api/v1/properties/${propertyId}/contact`)
      .expect(401);

    await request(httpServer(testApp))
      .get(`/api/v1/properties/${propertyId}/contact`)
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200)
      .expect(({ body }) => {
        const responseBody = body as ContactInfoBody;
        expect(responseBody.email).toBe('u5550002003@test.local');
        expect(responseBody.phone).toBe('+15550002003');
        expect(responseBody.whatsappUrl).toBe('https://wa.me/15550002003');
      });

    const auditEvent = await testApp.prisma.auditEvent.findFirst({
      where: { action: 'listing.contact_revealed', targetId: propertyId }
    });
    expect(auditEvent).toBeTruthy();
  });
});
