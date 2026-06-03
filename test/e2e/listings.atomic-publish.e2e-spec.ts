import request from 'supertest';
import {
  closeAuthTestApp,
  createAuthTestApp,
  httpServer,
  issueSession,
  type AuthTestApp
} from '../helpers/auth-test-app.js';
import { seedArea, seedCity } from '../helpers/test-db.js';

interface ErrorResponse {
  code: string;
}

describe('listings atomic publish (e2e)', () => {
  let testApp: AuthTestApp;

  beforeAll(async () => {
    testApp = await createAuthTestApp();
  });

  afterAll(async () => {
    await closeAuthTestApp(testApp);
  });

  it('returns 422 uploadMissing when an imageObjectKey was never uploaded and writes no Property', async () => {
    const session = await issueSession(testApp, 'u5550004003@test.local');
    await request(httpServer(testApp))
      .post('/api/v1/auth/select-role')
      .set('Authorization', `Bearer ${session.accessToken}`)
      .send({ role: 'Broker', officeName: 'Brokerage C' })
      .expect(200);

    const city = await seedCity(testApp.prisma, 'atomic-city');
    const area = await seedArea(testApp.prisma, city.id, 'atomic-area');

    const beforeCount = await testApp.prisma.property.count();

    const response = await request(httpServer(testApp))
      .post('/api/v1/properties')
      .set('Authorization', `Bearer ${session.accessToken}`)
      .send({
        title: 'Ghost Listing',
        description: 'Never uploaded',
        propertyType: 'apartment',
        listingType: 'sale',
        price: 100000,
        currency: 'USD',
        city: city.id,
        area: area.id,
        rooms: 2,
        bathrooms: 1,
        sizeSqm: 60,
        imageObjectKeys: [`uploads/${session.user.id}/never-uploaded.jpg`]
      })
      .expect(422);

    expect((response.body as ErrorResponse).code).toBe('uploadMissing');

    const afterCount = await testApp.prisma.property.count();
    expect(afterCount).toBe(beforeCount);
  });
});
