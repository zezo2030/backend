import {
  RequestMethod,
  UnauthorizedException,
  ValidationPipe,
  VersioningType,
  type INestApplication
} from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { execSync } from 'node:child_process';
import type { DecodedIdToken } from 'firebase-admin/auth';
import request from 'supertest';
import { PostgreSqlContainer, type StartedPostgreSqlContainer } from '@testcontainers/postgresql';
import { AppModule } from '../../src/app.module.js';
import { FirebaseAdminService } from '../../src/infra/firebase/firebase-admin.service.js';
import { ObjectStoreService } from '../../src/infra/objectstore/object-store.service.js';
import { PrismaService } from '../../src/infra/prisma/prisma.service.js';
import { FakeObjectStore } from '../helpers/fake-object-store.js';
import type { AuthResponseBody } from '../helpers/auth-test-app.js';

describe('auth phone (e2e)', () => {
  let postgres: StartedPostgreSqlContainer | undefined;
  let app: INestApplication;
  let prisma: PrismaService;
  const verifyIdToken = jest.fn<Promise<DecodedIdToken>, [string]>();

  beforeAll(async () => {
    const explicit = process.env.TEST_DATABASE_URL;
    const databaseUrl = explicit
      ? explicit
      : (() => {
          postgres = undefined;
          return '';
        })();

    let url = databaseUrl;
    if (!url) {
      postgres = await new PostgreSqlContainer('postgres:16-alpine').start();
      url = postgres.getConnectionUri();
    }

    process.env.NODE_ENV = 'test';
    process.env.DATABASE_URL = url;
    process.env.DIRECT_URL = url;
    execSync('npx prisma migrate deploy', {
      env: { ...process.env, DATABASE_URL: url },
      stdio: 'pipe'
    });

    process.env.JWT_ACCESS_SECRET = 'test-access-secret-at-least-16';
    process.env.JWT_REFRESH_SECRET = 'test-refresh-secret-at-least-16';
    process.env.JWT_ACCESS_TTL_SEC = '900';
    process.env.JWT_REFRESH_TTL_SEC = '2592000';
    process.env.PUSH_PROVIDER = 'stub';
    process.env.MAIL_PROVIDER = 'stub';
    process.env.SUPABASE_URL = 'https://test.supabase.co';
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-service-role-key-at-least-20-chars';
    process.env.SUPABASE_STORAGE_BUCKET = 'realestate-test';
    process.env.SUPABASE_STORAGE_PRESIGN_TTL_SEC = '600';
    process.env.IMAGE_MAX_BYTES = '8388608';
    process.env.DEV_RUN_WORKER = 'false';
    process.env.LOG_LEVEL = 'silent';
    process.env.FIREBASE_PROJECT_ID = 'test-project';

    const fakeObjectStore = new FakeObjectStore();
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(ObjectStoreService)
      .useValue(fakeObjectStore)
      .overrideProvider(FirebaseAdminService)
      .useValue({ verifyIdToken })
      .compile();

    app = moduleRef.createNestApplication();
    app.setGlobalPrefix('api', {
      exclude: [{ path: 'health', method: RequestMethod.ALL }]
    });
    app.enableVersioning({ type: VersioningType.URI, defaultVersion: '1' });
    app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true })
    );
    await app.init();
    prisma = app.get(PrismaService);
  });

  afterAll(async () => {
    await app?.close();
    if (postgres) await postgres.stop();
  });

  beforeEach(() => {
    verifyIdToken.mockReset();
  });

  it('creates a user and returns a session when the Firebase token is valid', async () => {
    verifyIdToken.mockResolvedValue({
      uid: 'firebase-uid-001',
      phone_number: '+201234567890'
    } as DecodedIdToken);

    const response = await request(app.getHttpServer())
      .post('/api/v1/auth/phone')
      .send({ idToken: 'valid-firebase-token', deviceId: 'android-test-1' })
      .expect(200);

    const body = response.body as AuthResponseBody;
    expect(typeof body.accessToken).toBe('string');
    expect(typeof body.refreshToken).toBe('string');
    expect(body.roleSelectionRequired).toBe(true);
    expect(body.user.role).toBeNull();

    const stored = await prisma.user.findFirst({
      where: { phone: '+201234567890', deletedAt: null }
    });
    expect(stored?.firebaseUid).toBe('firebase-uid-001');
    expect(stored?.isVerified).toBe(true);
  });

  it('reuses an existing user matched by phone on a second sign-in', async () => {
    verifyIdToken.mockResolvedValue({
      uid: 'firebase-uid-002',
      phone_number: '+201555000111'
    } as DecodedIdToken);

    const first = await request(app.getHttpServer())
      .post('/api/v1/auth/phone')
      .send({ idToken: 'token-1', deviceId: 'd1' })
      .expect(200);

    verifyIdToken.mockResolvedValue({
      uid: 'firebase-uid-002',
      phone_number: '+201555000111'
    } as DecodedIdToken);

    const second = await request(app.getHttpServer())
      .post('/api/v1/auth/phone')
      .send({ idToken: 'token-2', deviceId: 'd2' })
      .expect(200);

    expect((first.body as AuthResponseBody).user.id).toBe(
      (second.body as AuthResponseBody).user.id
    );
  });

  it('rejects tokens without a phone number claim', async () => {
    verifyIdToken.mockResolvedValue({
      uid: 'firebase-uid-no-phone'
    } as DecodedIdToken);

    await request(app.getHttpServer())
      .post('/api/v1/auth/phone')
      .send({ idToken: 'token-no-phone' })
      .expect(401);
  });

  it('rejects invalid Firebase tokens', async () => {
    verifyIdToken.mockRejectedValue(new UnauthorizedException('Invalid phone authentication token'));

    await request(app.getHttpServer())
      .post('/api/v1/auth/phone')
      .send({ idToken: 'bad-token' })
      .expect(401);
  });
});
