import request from 'supertest';
import { adminSession, sessionWithRole } from '../helpers/admin-helpers.js';
import {
  closeAuthTestApp,
  createAuthTestApp,
  httpServer,
  type AuthTestApp
} from '../helpers/auth-test-app.js';

type Method = 'get' | 'post' | 'patch' | 'delete';

interface Endpoint {
  method: Method;
  path: string;
  body?: Record<string, unknown>;
}

const SOME_ID = 'clnonexistent000000000000000';

const ENDPOINTS: Endpoint[] = [
  { method: 'get', path: '/api/v1/admin/users' },
  {
    method: 'patch',
    path: `/api/v1/admin/users/${SOME_ID}/status`,
    body: { isActive: false }
  },
  { method: 'get', path: '/api/v1/admin/properties' },
  {
    method: 'post',
    path: `/api/v1/admin/properties/${SOME_ID}/moderation`,
    body: { action: 'approve' }
  },
  { method: 'get', path: '/api/v1/admin/property-requests' },
  {
    method: 'post',
    path: '/api/v1/admin/locations/cities',
    body: { name: 'X', slug: 'xx' }
  },
  {
    method: 'post',
    path: '/api/v1/admin/locations/areas',
    body: { parentId: SOME_ID, name: 'X', slug: 'xx' }
  },
  { method: 'patch', path: `/api/v1/admin/locations/${SOME_ID}`, body: { name: 'Y' } },
  { method: 'delete', path: `/api/v1/admin/locations/${SOME_ID}` },
  {
    method: 'post',
    path: '/api/v1/admin/notifications/broadcast',
    body: { audience: 'all', title: 'x', body: 'y' }
  },
  { method: 'get', path: '/api/v1/admin/stats' },
  { method: 'get', path: '/api/v1/admin/reports' },
  {
    method: 'post',
    path: `/api/v1/admin/reports/${SOME_ID}/resolve`,
    body: { outcome: 'dismissed' }
  }
];

describe('admin authorization matrix (e2e)', () => {
  let testApp: AuthTestApp;

  beforeAll(async () => {
    testApp = await createAuthTestApp();
  });

  afterAll(async () => {
    await closeAuthTestApp(testApp);
  });

  it('every admin endpoint returns 401 unauthenticated and 403 for non-admins', async () => {
    const broker = await sessionWithRole(testApp, 'u5553500001@test.local', 'Broker');
    const regular = await sessionWithRole(testApp, 'u5553500002@test.local', 'RegularUser');
    const agency = await sessionWithRole(testApp, 'u5553500003@test.local', 'Agency');

    for (const endpoint of ENDPOINTS) {
      let unauth = request(httpServer(testApp))[endpoint.method](endpoint.path);
      if (endpoint.body) unauth = unauth.send(endpoint.body);
      await unauth.expect(401);

      for (const session of [broker, regular, agency]) {
        let req = request(httpServer(testApp))
          [endpoint.method](endpoint.path)
          .set('Authorization', `Bearer ${session.accessToken}`);
        if (endpoint.body) req = req.send(endpoint.body);
        await req.expect(403);
      }
    }
  });

  it('admin can hit all admin endpoints (returns 2xx, 404, or 422 — never 401/403)', async () => {
    const admin = await adminSession(testApp, 'u5553500004@test.local');

    for (const endpoint of ENDPOINTS) {
      let req = request(httpServer(testApp))
        [endpoint.method](endpoint.path)
        .set('Authorization', `Bearer ${admin.accessToken}`);
      if (endpoint.body) req = req.send(endpoint.body);
      const response = await req;
      expect([401, 403]).not.toContain(response.status);
    }
  });
});
