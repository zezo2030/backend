import fs from 'node:fs';
import path from 'node:path';
import request from 'supertest';
import yaml from 'js-yaml';
import { makeApiSpec, makeResponse } from 'openapi-validator';
import type { RawResponse } from 'openapi-validator';
import type { OpenAPIV3 } from 'openapi-types';
import { MAIL_SENDER, StubMailSender } from '../../src/infra/mail/mail.provider.js';
import {
  closeAuthTestApp,
  createAuthTestApp,
  httpServer,
  type AuthResponseBody,
  type AuthTestApp
} from '../helpers/auth-test-app.js';
import { adminSession, sessionWithRole } from '../helpers/admin-helpers.js';
import { makePropertyRequestPayload } from '../helpers/property-request-payload.js';
import { seedArea, seedCity, seedProperty } from '../helpers/test-db.js';

const OPENAPI_PATH = path.resolve(
  __dirname,
  '..',
  '..',
  '..',
  'specs',
  '001-realestate-backend-api',
  'contracts',
  'openapi.yaml'
);

const rawSpec = yaml.load(fs.readFileSync(OPENAPI_PATH, 'utf8')) as OpenAPIV3.Document;
rawSpec.servers = [{ url: '/api/v1' }];
const apiSpec = makeApiSpec(rawSpec);

function assertConformant(label: string, res: request.Response): void {
  const actualResponse = makeResponse(res as unknown as RawResponse);
  const validationError = apiSpec.validateResponse(actualResponse);
  if (validationError) {
    throw new Error(`${label} did not satisfy the OpenAPI contract: ${validationError.toString()}`);
  }
}

jest.setTimeout(60_000);

describe('OpenAPI contract conformance', () => {
  let testApp: AuthTestApp;

  beforeAll(async () => {
    testApp = await createAuthTestApp();
  });

  afterAll(async () => {
    await closeAuthTestApp(testApp);
  });

  it('auth happy path conforms to the contract', async () => {
    const register = await request(httpServer(testApp)).post('/api/v1/auth/register').send({
      email: 'u5559900001@test.local',
      password: 'sup3rsecret',
      displayName: 'Contract User'
    });
    expect(register.status).toBe(201);
    assertConformant('POST /auth/register', register);

    const broker = register.body as AuthResponseBody;

    const login = await request(httpServer(testApp))
      .post('/api/v1/auth/login')
      .send({ email: 'u5559900001@test.local', password: 'sup3rsecret' });
    expect(login.status).toBe(200);
    assertConformant('POST /auth/login', login);

    const selectRole = await request(httpServer(testApp))
      .post('/api/v1/auth/select-role')
      .set('Authorization', `Bearer ${broker.accessToken}`)
      .send({ role: 'Broker', officeName: 'Contract Realty' });
    expect(selectRole.status).toBe(200);
    assertConformant('POST /auth/select-role', selectRole);

    const me = await request(httpServer(testApp))
      .get('/api/v1/auth/me')
      .set('Authorization', `Bearer ${broker.accessToken}`);
    expect(me.status).toBe(200);
    assertConformant('GET /auth/me', me);
  });

  it('password reset flow conforms to the contract', async () => {
    const email = 'u5559900099@test.local';
    const mail = testApp.app.get(MAIL_SENDER) as StubMailSender;
    mail.clear();

    await request(httpServer(testApp)).post('/api/v1/auth/register').send({
      email,
      password: 'sup3rsecret',
      displayName: 'Reset Contract'
    });

    const resetRequest = await request(httpServer(testApp))
      .post('/api/v1/auth/password-reset/request')
      .send({ email });
    expect(resetRequest.status).toBe(204);
    assertConformant('POST /auth/password-reset/request', resetRequest);

    const code = mail.lastCode();
    expect(code).toBeDefined();

    const verify = await request(httpServer(testApp))
      .post('/api/v1/auth/password-reset/verify')
      .send({ email, code });
    expect(verify.status).toBe(200);
    assertConformant('POST /auth/password-reset/verify', verify);

    const confirm = await request(httpServer(testApp))
      .post('/api/v1/auth/password-reset/confirm')
      .send({
        email,
        resetToken: verify.body.resetToken,
        password: 'newSup3rsecret'
      });
    expect(confirm.status).toBe(204);
    assertConformant('POST /auth/password-reset/confirm', confirm);
  });

  it('properties feed, detail, contact, and presigned upload conform', async () => {
    const broker = await sessionWithRole(testApp, 'u5559900011@test.local', 'Broker');
    const city = await seedCity(testApp.prisma, 'contract-city');
    const area = await seedArea(testApp.prisma, city.id, 'contract-area');
    const property = await seedProperty(testApp.prisma, {
      ownerId: broker.user.id,
      title: 'Contract Coverage Listing',
      propertyType: 'apartment',
      listingType: 'sale',
      price: 250000,
      cityId: city.id,
      areaId: area.id,
      rooms: 3,
      furnished: 'furnished',
      createdAt: new Date(),
      objectKeySuffix: 'contract-listing'
    });

    const feed = await request(httpServer(testApp)).get('/api/v1/properties');
    expect(feed.status).toBe(200);
    assertConformant('GET /properties', feed);

    const detail = await request(httpServer(testApp)).get(
      `/api/v1/properties/${property.id}`
    );
    expect(detail.status).toBe(200);
    assertConformant('GET /properties/{id}', detail);

    const contactUnauth = await request(httpServer(testApp)).get(
      `/api/v1/properties/${property.id}/contact`
    );
    expect(contactUnauth.status).toBe(401);
    assertConformant('GET /properties/{id}/contact (401)', contactUnauth);

    const contact = await request(httpServer(testApp))
      .get(`/api/v1/properties/${property.id}/contact`)
      .set('Authorization', `Bearer ${broker.accessToken}`);
    expect(contact.status).toBe(200);
    assertConformant('GET /properties/{id}/contact (200)', contact);

    const presign = await request(httpServer(testApp))
      .post('/api/v1/media/uploads')
      .set('Authorization', `Bearer ${broker.accessToken}`)
      .send({ items: [{ contentType: 'image/jpeg', sizeBytes: 2048 }] });
    expect(presign.status).toBe(201);
    assertConformant('POST /media/uploads', presign);
  });

  it('property-requests create + broker feed conform', async () => {
    const broker = await sessionWithRole(testApp, 'u5559900021@test.local', 'Broker');
    const seeker = await sessionWithRole(testApp, 'u5559900022@test.local', 'RegularUser');
    const payload = await makePropertyRequestPayload(testApp.prisma);

    const created = await request(httpServer(testApp))
      .post('/api/v1/property-requests')
      .set('Authorization', `Bearer ${seeker.accessToken}`)
      .send(payload);
    expect(created.status).toBe(202);
    assertConformant('POST /property-requests', created);

    const brokerFeed = await request(httpServer(testApp))
      .get('/api/v1/property-requests')
      .set('Authorization', `Bearer ${broker.accessToken}`);
    expect(brokerFeed.status).toBe(200);
    assertConformant('GET /property-requests (broker)', brokerFeed);

    const forbidden = await request(httpServer(testApp))
      .get('/api/v1/property-requests')
      .set('Authorization', `Bearer ${seeker.accessToken}`);
    expect(forbidden.status).toBe(403);
    assertConformant('GET /property-requests (403)', forbidden);
  });

  it('favorites, notifications inbox, and reports conform', async () => {
    const broker = await sessionWithRole(testApp, 'u5559900031@test.local', 'Broker');
    const user = await sessionWithRole(testApp, 'u5559900032@test.local', 'RegularUser');
    const city = await seedCity(testApp.prisma, 'fav-contract-city');
    const area = await seedArea(testApp.prisma, city.id, 'fav-contract-area');
    const property = await seedProperty(testApp.prisma, {
      ownerId: broker.user.id,
      title: 'Favoritable Listing',
      propertyType: 'house',
      listingType: 'sale',
      price: 400000,
      cityId: city.id,
      areaId: area.id,
      rooms: 4,
      furnished: 'unfurnished',
      createdAt: new Date(),
      objectKeySuffix: 'favoritable'
    });

    const fav = await request(httpServer(testApp))
      .put(`/api/v1/favorites/${property.id}`)
      .set('Authorization', `Bearer ${user.accessToken}`);
    expect(fav.status).toBe(204);
    assertConformant('PUT /favorites/{propertyId}', fav);

    const favList = await request(httpServer(testApp))
      .get('/api/v1/favorites')
      .set('Authorization', `Bearer ${user.accessToken}`);
    expect(favList.status).toBe(200);
    assertConformant('GET /favorites', favList);

    const inbox = await request(httpServer(testApp))
      .get('/api/v1/notifications')
      .set('Authorization', `Bearer ${user.accessToken}`);
    expect(inbox.status).toBe(200);
    assertConformant('GET /notifications', inbox);

    const report = await request(httpServer(testApp))
      .post('/api/v1/reports')
      .set('Authorization', `Bearer ${user.accessToken}`)
      .send({
        targetType: 'property',
        targetId: property.id,
        reason: 'Picture does not match description.'
      });
    expect(report.status).toBe(201);
    assertConformant('POST /reports', report);
  });

  it('admin stats, users list, and locations conform', async () => {
    const admin = await adminSession(testApp, 'u5559900041@test.local');

    const stats = await request(httpServer(testApp))
      .get('/api/v1/admin/stats')
      .set('Authorization', `Bearer ${admin.accessToken}`);
    expect(stats.status).toBe(200);
    assertConformant('GET /admin/stats', stats);

    const users = await request(httpServer(testApp))
      .get('/api/v1/admin/users')
      .set('Authorization', `Bearer ${admin.accessToken}`);
    expect(users.status).toBe(200);
    assertConformant('GET /admin/users', users);

    const cities = await request(httpServer(testApp)).get('/api/v1/locations/cities');
    expect(cities.status).toBe(200);
    assertConformant('GET /locations/cities', cities);
  });
});
