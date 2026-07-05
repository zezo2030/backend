import { execSync } from 'node:child_process';
import { RequestMethod, ValidationPipe, VersioningType } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import type { INestApplication } from '@nestjs/common';
import { PostgreSqlContainer, type StartedPostgreSqlContainer } from '@testcontainers/postgresql';
import request from 'supertest';
import { AppModule } from '../../src/app.module.js';
import { PrismaService } from '../../src/infra/prisma/prisma.service.js';
import { ObjectStoreService } from '../../src/infra/objectstore/object-store.service.js';
import { FakeObjectStore } from './fake-object-store.js';

export interface AuthTestApp {
  app: INestApplication;
  prisma: PrismaService;
  /** Set when tests start an ephemeral Postgres container; omitted when using TEST_DATABASE_URL. */
  postgres?: StartedPostgreSqlContainer;
  objectStore: FakeObjectStore;
}

export interface CreateAuthTestAppOptions {
  presignTtlSec?: number;
}

export interface AuthResponseBody {
  accessToken: string;
  refreshToken: string;
  expiresInSec: number;
  roleSelectionRequired: boolean;
  user: {
    id: string;
    email: string;
    role: string | null;
    isVerified: boolean;
  };
}

export interface UserSelfBody {
  id: string;
  email: string;
  role: string | null;
}

export interface ErrorBody {
  code: string;
  message: string;
}

export function httpServer(testApp: AuthTestApp): Parameters<typeof request>[0] {
  return testApp.app.getHttpServer() as Parameters<typeof request>[0];
}

async function resolveTestDatabaseUrl(): Promise<{
  url: string;
  postgres?: StartedPostgreSqlContainer;
}> {
  const explicit = process.env.TEST_DATABASE_URL;
  if (explicit) {
    return { url: explicit };
  }
  try {
    const postgres = await new PostgreSqlContainer('postgres:16-alpine').start();
    return { url: postgres.getConnectionUri(), postgres };
  } catch {
    const fallback = process.env.DATABASE_URL;
    if (fallback?.startsWith('postgres')) {
      return { url: fallback };
    }
    throw new Error(
      'PostgreSQL tests need Docker (Testcontainers) or TEST_DATABASE_URL / postgres DATABASE_URL'
    );
  }
}

export async function createAuthTestApp(
  options: CreateAuthTestAppOptions = {}
): Promise<AuthTestApp> {
  const { url: databaseUrl, postgres } = await resolveTestDatabaseUrl();
  process.env.NODE_ENV = 'test';
  process.env.DATABASE_URL = databaseUrl;
  execSync('npx prisma migrate deploy', {
    env: { ...process.env, DATABASE_URL: databaseUrl },
    stdio: 'pipe'
  });

  process.env.JWT_ACCESS_SECRET = 'test-access-secret-at-least-16';
  process.env.JWT_REFRESH_SECRET = 'test-refresh-secret-at-least-16';
  process.env.JWT_ACCESS_TTL_SEC = '900';
  process.env.JWT_REFRESH_TTL_SEC = '2592000';
  process.env.PUSH_PROVIDER = 'stub';
  process.env.MAIL_PROVIDER = 'stub';
  process.env.DIRECT_URL = databaseUrl;
  process.env.SUPABASE_URL = 'https://test.supabase.co';
  process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-service-role-key-at-least-20-chars';
  process.env.SUPABASE_STORAGE_BUCKET = 'realestate-test';
  process.env.SUPABASE_STORAGE_PRESIGN_TTL_SEC = String(options.presignTtlSec ?? 600);
  process.env.IMAGE_MAX_BYTES = '8388608';
  process.env.MEDIA_COMPRESSION_ENABLED = 'false';
  process.env.DEV_RUN_WORKER = 'false';
  process.env.LOG_LEVEL = 'silent';

  const fakeObjectStore = new FakeObjectStore();
  const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
    .overrideProvider(ObjectStoreService)
    .useValue(fakeObjectStore)
    .compile();
  const app = moduleRef.createNestApplication();
  app.setGlobalPrefix('api', {
    exclude: [{ path: 'health', method: RequestMethod.ALL }]
  });
  app.enableVersioning({ type: VersioningType.URI, defaultVersion: '1' });
  app.useGlobalPipes(
    new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true })
  );
  await app.init();
  return {
    app,
    prisma: app.get(PrismaService),
    postgres,
    objectStore: fakeObjectStore
  };
}

export async function closeAuthTestApp(testApp: AuthTestApp | undefined): Promise<void> {
  if (!testApp) return;
  await testApp.app.close();
  if (testApp.postgres) await testApp.postgres.stop();
}

export const TEST_PASSWORD = 'test-password-123';

export async function issueSession(testApp: AuthTestApp, email: string): Promise<AuthResponseBody> {
  const displayName = email.split('@')[0] ?? 'Test User';
  const registered = await request(httpServer(testApp))
    .post('/api/v1/auth/register')
    .send({ email, password: TEST_PASSWORD, displayName, deviceId: 'test-device' });
  if (registered.status === 201) {
    return registered.body as AuthResponseBody;
  }
  return request(httpServer(testApp))
    .post('/api/v1/auth/login')
    .send({ email, password: TEST_PASSWORD, deviceId: 'test-device' })
    .expect(200)
    .then((response) => response.body as AuthResponseBody);
}
