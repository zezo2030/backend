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
  ownerEmail: string;
  android: {
    packageName: string;
    certFingerprints: string[];
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

const boolFromEnv = (value: string | undefined, fallback: boolean): boolean => {
  if (value === undefined || value === '') return fallback;
  return value === 'true';
};

export default (): AppConfig => ({
  nodeEnv: process.env.NODE_ENV ?? 'development',
  port: Number(process.env.PORT ?? 3000),
  databaseUrl: process.env.DATABASE_URL ?? '',
  directDatabaseUrl: process.env.DIRECT_URL ?? process.env.DATABASE_URL ?? '',
  jwt: {
    accessSecret: process.env.JWT_ACCESS_SECRET ?? '',
    accessTtlSec: Number(process.env.JWT_ACCESS_TTL_SEC ?? 900),
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
  ownerEmail: (process.env.OWNER_EMAIL ?? '').trim().toLowerCase(),
  android: {
    packageName: (process.env.ANDROID_PACKAGE_NAME ?? 'com.riden74.app').trim(),
    certFingerprints: (process.env.ANDROID_CERT_SHA256 ?? '')
      .split(',')
      .map((fp) => fp.trim().toUpperCase())
      .filter(Boolean)
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
