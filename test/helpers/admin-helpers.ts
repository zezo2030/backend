import request from 'supertest';
import {
  httpServer,
  issueSession,
  type AuthResponseBody,
  type AuthTestApp
} from './auth-test-app.js';

export interface RoleSession extends AuthResponseBody {}

export async function sessionWithRole(
  testApp: AuthTestApp,
  email: string,
  role: 'RegularUser' | 'Broker' | 'Agency'
): Promise<RoleSession> {
  const first = await issueSession(testApp, email);
  await request(httpServer(testApp))
    .post('/api/v1/auth/select-role')
    .set('Authorization', `Bearer ${first.accessToken}`)
    .send({ role, officeName: role === 'RegularUser' ? undefined : `${role} Office` })
    .expect(200);
  return issueSession(testApp, email);
}

export async function adminSession(testApp: AuthTestApp, email: string): Promise<RoleSession> {
  const first = await issueSession(testApp, email);
  await testApp.prisma.user.update({
    where: { id: first.user.id },
    data: { role: 'Admin' }
  });
  return issueSession(testApp, email);
}
