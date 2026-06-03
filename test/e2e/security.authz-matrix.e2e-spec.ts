import request from 'supertest';
import { adminSession, sessionWithRole, type RoleSession } from '../helpers/admin-helpers.js';
import {
  closeAuthTestApp,
  createAuthTestApp,
  httpServer,
  type AuthTestApp
} from '../helpers/auth-test-app.js';
import { seedArea, seedCity, seedProperty } from '../helpers/test-db.js';

type Method = 'get' | 'post' | 'put' | 'patch' | 'delete';
type RoleKey = 'anon' | 'regular' | 'broker' | 'agency' | 'admin';

interface AuthzCase {
  label: string;
  method: Method;
  path: string;
  body?: Record<string, unknown>;
  /** Allowed status codes per role; the test asserts the response status is in the list. */
  expected: Record<RoleKey, number[]>;
}

const ROLE_KEYS: RoleKey[] = ['anon', 'regular', 'broker', 'agency', 'admin'];

describe('SC-011 endpoint × role authorization matrix (e2e)', () => {
  let testApp: AuthTestApp;
  let sessions: Record<Exclude<RoleKey, 'anon'>, RoleSession>;
  let propertyId: string;
  let city: string;
  let area: string;

  beforeAll(async () => {
    testApp = await createAuthTestApp();
    const regular = await sessionWithRole(testApp, 'u5558800001@test.local', 'RegularUser');
    const broker = await sessionWithRole(testApp, 'u5558800002@test.local', 'Broker');
    const agency = await sessionWithRole(testApp, 'u5558800003@test.local', 'Agency');
    const admin = await adminSession(testApp, 'u5558800004@test.local');
    sessions = { regular, broker, agency, admin };

    city = (await seedCity(testApp.prisma, 'matrix-city')).id;
    area = (await seedArea(testApp.prisma, city, 'matrix-area')).id;
    const created = await seedProperty(testApp.prisma, {
      ownerId: broker.user.id,
      title: 'Matrix Property',
      propertyType: 'apartment',
      listingType: 'rent',
      price: 1000,
      city,
      area,
      rooms: 2,
      furnished: 'unfurnished',
      createdAt: new Date(),
      objectKeySuffix: 'matrix'
    });
    propertyId = created.id;
  });

  afterAll(async () => {
    await closeAuthTestApp(testApp);
  });

  function tokenFor(role: RoleKey): string | null {
    if (role === 'anon') return null;
    return sessions[role].accessToken;
  }

  function buildCases(): AuthzCase[] {
    const someId = 'clnonexistent000000000000001';
    return [
      {
        label: 'GET /properties',
        method: 'get',
        path: '/api/v1/properties',
        expected: { anon: [200], regular: [200], broker: [200], agency: [200], admin: [200] }
      },
      {
        label: 'GET /properties/{id}',
        method: 'get',
        path: `/api/v1/properties/${propertyId}`,
        expected: { anon: [200], regular: [200], broker: [200], agency: [200], admin: [200] }
      },
      {
        label: 'GET /locations/cities',
        method: 'get',
        path: '/api/v1/locations/cities',
        expected: { anon: [200], regular: [200], broker: [200], agency: [200], admin: [200] }
      },
      {
        label: 'POST /auth/login',
        method: 'post',
        path: '/api/v1/auth/login',
        body: { email: 'u5558809999@test.local', password: 'wrong-password' },
        expected: { anon: [401], regular: [401], broker: [401], agency: [401], admin: [401] }
      },
      {
        label: 'GET /auth/me',
        method: 'get',
        path: '/api/v1/auth/me',
        expected: { anon: [401], regular: [200], broker: [200], agency: [200], admin: [200] }
      },
      {
        label: 'GET /users/profile',
        method: 'get',
        path: '/api/v1/users/profile',
        expected: { anon: [401], regular: [200], broker: [200], agency: [200], admin: [200] }
      },
      {
        label: 'GET /properties/mine',
        method: 'get',
        path: '/api/v1/properties/mine',
        expected: { anon: [401], regular: [200], broker: [200], agency: [200], admin: [200] }
      },
      {
        label: 'GET /property-requests/mine',
        method: 'get',
        path: '/api/v1/property-requests/mine',
        expected: { anon: [401], regular: [200], broker: [200], agency: [200], admin: [200] }
      },
      {
        label: 'POST /media/uploads',
        method: 'post',
        path: '/api/v1/media/uploads',
        body: { items: [{ contentType: 'image/jpeg', sizeBytes: 1024 }] },
        expected: { anon: [401], regular: [201], broker: [201], agency: [201], admin: [201] }
      },
      {
        label: 'GET /favorites',
        method: 'get',
        path: '/api/v1/favorites',
        expected: { anon: [401], regular: [200], broker: [200], agency: [200], admin: [200] }
      },
      {
        label: 'PUT /favorites/{propertyId}',
        method: 'put',
        path: `/api/v1/favorites/${propertyId}`,
        expected: { anon: [401], regular: [204], broker: [204], agency: [204], admin: [204] }
      },
      {
        label: 'GET /notifications',
        method: 'get',
        path: '/api/v1/notifications',
        expected: { anon: [401], regular: [200], broker: [200], agency: [200], admin: [200] }
      },
      {
        label: 'POST /reports',
        method: 'post',
        path: '/api/v1/reports',
        body: { targetType: 'property', targetId: propertyId, reason: 'Matrix coverage' },
        expected: { anon: [401], regular: [201], broker: [201], agency: [201], admin: [201] }
      },
      {
        label: 'GET /properties/{id}/contact',
        method: 'get',
        path: `/api/v1/properties/${propertyId}/contact`,
        expected: { anon: [401], regular: [200], broker: [200], agency: [200], admin: [200] }
      },
      {
        label: 'GET /property-requests',
        method: 'get',
        path: '/api/v1/property-requests',
        expected: { anon: [401], regular: [403], broker: [200], agency: [200], admin: [403] }
      },
      {
        label: 'GET /property-requests/{id}/contact',
        method: 'get',
        path: `/api/v1/property-requests/${someId}/contact`,
        expected: { anon: [401], regular: [403], broker: [404], agency: [404], admin: [403] }
      },
      {
        label: 'GET /admin/users',
        method: 'get',
        path: '/api/v1/admin/users',
        expected: { anon: [401], regular: [403], broker: [403], agency: [403], admin: [200] }
      },
      {
        label: 'GET /admin/stats',
        method: 'get',
        path: '/api/v1/admin/stats',
        expected: { anon: [401], regular: [403], broker: [403], agency: [403], admin: [200] }
      },
      {
        label: 'GET /admin/properties',
        method: 'get',
        path: '/api/v1/admin/properties',
        expected: { anon: [401], regular: [403], broker: [403], agency: [403], admin: [200] }
      },
      {
        label: 'GET /admin/property-requests',
        method: 'get',
        path: '/api/v1/admin/property-requests',
        expected: { anon: [401], regular: [403], broker: [403], agency: [403], admin: [200] }
      },
      {
        label: 'GET /admin/reports',
        method: 'get',
        path: '/api/v1/admin/reports',
        expected: { anon: [401], regular: [403], broker: [403], agency: [403], admin: [200] }
      }
    ];
  }

  it('returns the expected status for every endpoint × role combination', async () => {
    const cases = buildCases();
    const failures: string[] = [];

    for (const c of cases) {
      for (const role of ROLE_KEYS) {
        let req = request(httpServer(testApp))[c.method](c.path);
        const token = tokenFor(role);
        if (token) req = req.set('Authorization', `Bearer ${token}`);
        if (c.body) req = req.send(c.body);
        const res = await req;
        const allowed = c.expected[role];
        if (!allowed.includes(res.status)) {
          failures.push(
            `${c.label} as ${role}: expected status in [${allowed.join(',')}], got ${res.status}`
          );
        }
      }
    }

    if (failures.length > 0) {
      throw new Error(`\nSC-011 matrix violations:\n  - ${failures.join('\n  - ')}`);
    }
  });
});
