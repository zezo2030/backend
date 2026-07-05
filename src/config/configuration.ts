export interface AppConfig {
  nodeEnv: string;
  port: number;
  databaseUrl: string;
  directDatabaseUrl: string;
  jwt: {
    accessSecret: string;
    accessTtlSec: number;
    refreshSecret: string;
    refreshTtlSec: number;
  };
  firebase: {
    projectId?: string;
    clientEmail?: string;
    privateKey?: string;
    serviceAccountPath?: string;
  };
  push: {
    provider: 'fcm' | 'stub';
  };
  supabase: {
    url: string;
    serviceRoleKey: string;
    storageBucket: string;
    presignTtlSec: number;
  };
  imageMaxBytes: number;
  videoMaxBytes: number;
  mediaCompression: {
    enabled: boolean;
    imageMaxDimension: number;
    imageWebpQuality: number;
    imageSkipBelowBytes: number;
    videoMaxHeight: number;
    videoCrf: number;
    videoSkipBelowBytes: number;
    videoTranscodeTimeoutMs: number;
  };
  ownerEmail: string;
  android: {
    packageName: string;
    certFingerprints: string[];
    assetLinksJson?: string;
    assetLinksPath?: string;
    apps: AndroidAppConfig[];
  };
  devRunWorker: boolean;
  logLevel: string;
  mail: {
    provider: 'smtp' | 'stub';
    from: string;
    smtp: {
      host: string;
      port: number;
      user?: string;
      pass?: string;
    };
  };
  passwordReset: {
    codeTtlSec: number;
    resetTokenTtlSec: number;
    maxAttempts: number;
    maxRequestsPerHour: number;
  };
}

export interface AndroidAppConfig {
  packageName: string;
  certFingerprints: string[];
  relations: string[];
}

const boolFromEnv = (value: string | undefined, fallback: boolean): boolean => {
  if (value === undefined || value === '') return fallback;
  return value === 'true';
};

const DEFAULT_HANDLE_URLS = 'delegate_permission/common.handle_all_urls';

const parseAndroidApps = (): AndroidAppConfig[] => {
  const raw = process.env.ANDROID_APPS?.trim();
  if (raw) {
    const parsed = JSON.parse(raw) as Array<{
      packageName: string;
      certFingerprints?: string[];
      fingerprints?: string[];
      relations?: string[];
    }>;
    return parsed.map((app) => ({
      packageName: app.packageName.trim(),
      certFingerprints: (app.certFingerprints ?? app.fingerprints ?? [])
        .map((fp) => fp.trim().toUpperCase())
        .filter(Boolean),
      relations: app.relations?.length ? app.relations : [DEFAULT_HANDLE_URLS]
    }));
  }

  const legacyPackage = (process.env.ANDROID_PACKAGE_NAME ?? 'com.realestatemobile').trim();
  const legacyFingerprints = (process.env.ANDROID_CERT_SHA256 ?? '')
    .split(',')
    .map((fp) => fp.trim().toUpperCase())
    .filter(Boolean);

  const apps: AndroidAppConfig[] = [];
  if (legacyFingerprints.length > 0) {
    apps.push({
      packageName: legacyPackage,
      certFingerprints: legacyFingerprints,
      relations: [DEFAULT_HANDLE_URLS]
    });
  }

  const package2 = process.env.ANDROID_PACKAGE_NAME_2?.trim();
  const fingerprints2 = (process.env.ANDROID_CERT_SHA256_2 ?? '')
    .split(',')
    .map((fp) => fp.trim().toUpperCase())
    .filter(Boolean);
  if (package2 && fingerprints2.length > 0) {
    const relations2 = (process.env.ANDROID_RELATIONS_2 ?? DEFAULT_HANDLE_URLS)
      .split(',')
      .map((r) => r.trim())
      .filter(Boolean);
    apps.push({
      packageName: package2,
      certFingerprints: fingerprints2,
      relations: relations2
    });
  }

  return apps;
};

export default (): AppConfig => ({
  nodeEnv: process.env.NODE_ENV ?? 'development',
  port: Number(process.env.PORT ?? 3000),
  databaseUrl: process.env.DATABASE_URL ?? '',
  directDatabaseUrl: process.env.DIRECT_URL ?? process.env.DATABASE_URL ?? '',
  jwt: {
    accessSecret: process.env.JWT_ACCESS_SECRET ?? '',
    accessTtlSec: Number(process.env.JWT_ACCESS_TTL_SEC ?? 86400),
    refreshSecret: process.env.JWT_REFRESH_SECRET ?? '',
    refreshTtlSec: Number(process.env.JWT_REFRESH_TTL_SEC ?? 2592000)
  },
  firebase: {
    projectId: process.env.FIREBASE_PROJECT_ID || undefined,
    clientEmail: process.env.FIREBASE_CLIENT_EMAIL || undefined,
    privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n') || undefined,
    serviceAccountPath: process.env.FIREBASE_SERVICE_ACCOUNT_PATH || undefined
  },
  push: {
    provider: (process.env.PUSH_PROVIDER ?? 'stub') as AppConfig['push']['provider']
  },
  supabase: {
    url: process.env.SUPABASE_URL ?? '',
    serviceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY ?? '',
    storageBucket: process.env.SUPABASE_STORAGE_BUCKET ?? '',
    presignTtlSec: Number(process.env.SUPABASE_STORAGE_PRESIGN_TTL_SEC ?? 600)
  },
  imageMaxBytes: Number(process.env.IMAGE_MAX_BYTES ?? 8388608),
  videoMaxBytes: Number(process.env.VIDEO_MAX_BYTES ?? 104857600),
  mediaCompression: {
    enabled: boolFromEnv(process.env.MEDIA_COMPRESSION_ENABLED, true),
    imageMaxDimension: Number(process.env.IMAGE_MAX_DIMENSION ?? 1920),
    imageWebpQuality: Number(process.env.IMAGE_WEBP_QUALITY ?? 80),
    imageSkipBelowBytes: Number(process.env.IMAGE_SKIP_BELOW_BYTES ?? 307200),
    videoMaxHeight: Number(process.env.VIDEO_MAX_HEIGHT ?? 720),
    videoCrf: Number(process.env.VIDEO_CRF ?? 28),
    videoSkipBelowBytes: Number(process.env.VIDEO_SKIP_BELOW_BYTES ?? 5242880),
    videoTranscodeTimeoutMs: Number(process.env.VIDEO_TRANSCODE_TIMEOUT_MS ?? 120000)
  },
  ownerEmail: (process.env.OWNER_EMAIL ?? '').trim().toLowerCase(),
  android: {
    packageName: (process.env.ANDROID_PACKAGE_NAME ?? 'com.riden74.app').trim(),
    certFingerprints: (process.env.ANDROID_CERT_SHA256 ?? '')
      .split(',')
      .map((fp) => fp.trim().toUpperCase())
      .filter(Boolean),
    assetLinksJson: process.env.ANDROID_ASSET_LINKS_JSON?.trim() || undefined,
    assetLinksPath: process.env.ANDROID_ASSET_LINKS_PATH?.trim() || undefined,
    apps: parseAndroidApps()
  },
  devRunWorker: boolFromEnv(process.env.DEV_RUN_WORKER, false),
  logLevel: process.env.LOG_LEVEL ?? 'info',
  mail: {
    provider: (process.env.MAIL_PROVIDER ?? 'stub') as AppConfig['mail']['provider'],
    from: process.env.MAIL_FROM ?? process.env.SMTP_FROM ?? 'noreply@localhost',
    smtp: {
      host: process.env.MAIL_SMTP_HOST ?? process.env.SMTP_HOST ?? 'localhost',
      port: Number(process.env.MAIL_SMTP_PORT ?? process.env.SMTP_PORT ?? 587),
      user: (process.env.MAIL_SMTP_USER ?? process.env.SMTP_USER) || undefined,
      pass: (process.env.MAIL_SMTP_PASS ?? process.env.SMTP_PASS) || undefined
    }
  },
  passwordReset: {
    codeTtlSec: Number(process.env.PASSWORD_RESET_CODE_TTL_SEC ?? 600),
    resetTokenTtlSec: Number(process.env.PASSWORD_RESET_TOKEN_TTL_SEC ?? 900),
    maxAttempts: Number(process.env.PASSWORD_RESET_MAX_ATTEMPTS ?? 5),
    maxRequestsPerHour: Number(process.env.PASSWORD_RESET_MAX_REQUESTS_PER_HOUR ?? 3)
  }
});
