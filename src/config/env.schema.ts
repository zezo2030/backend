import Joi from 'joi';

export const envValidationSchema = Joi.object({
  NODE_ENV: Joi.string().valid('development', 'test', 'production').required(),
  PORT: Joi.number().port().default(3000),
  DATABASE_URL: Joi.string()
    .uri({ scheme: ['postgresql', 'postgres'] })
    .required(),
  DIRECT_URL: Joi.string()
    .uri({ scheme: ['postgresql', 'postgres'] })
    .optional(),
  JWT_ACCESS_SECRET: Joi.string().min(16).required(),
  JWT_ACCESS_TTL_SEC: Joi.number().integer().positive().default(86400),
  JWT_REFRESH_SECRET: Joi.string().min(16).required(),
  JWT_REFRESH_TTL_SEC: Joi.number().integer().positive().default(2592000),
  FIREBASE_PROJECT_ID: Joi.when('PUSH_PROVIDER', {
    is: 'fcm',
    then: Joi.string().required(),
    otherwise: Joi.string().allow('').optional()
  }),
  FIREBASE_SERVICE_ACCOUNT_PATH: Joi.string().allow('').optional(),
  FIREBASE_CLIENT_EMAIL: Joi.string().allow('').optional(),
  FIREBASE_PRIVATE_KEY: Joi.string().allow('').optional(),
  PUSH_PROVIDER: Joi.string().valid('fcm', 'stub').required(),
  SUPABASE_URL: Joi.string().uri().required(),
  SUPABASE_SERVICE_ROLE_KEY: Joi.string().min(20).required(),
  SUPABASE_STORAGE_BUCKET: Joi.string().required(),
  SUPABASE_STORAGE_PRESIGN_TTL_SEC: Joi.number().integer().positive().default(600),
  IMAGE_MAX_BYTES: Joi.number().integer().positive().default(8388608),
  VIDEO_MAX_BYTES: Joi.number().integer().positive().default(104857600),
  MEDIA_COMPRESSION_ENABLED: Joi.boolean().default(true),
  IMAGE_MAX_DIMENSION: Joi.number().integer().positive().default(1920),
  IMAGE_WEBP_QUALITY: Joi.number().integer().min(1).max(100).default(80),
  IMAGE_SKIP_BELOW_BYTES: Joi.number().integer().positive().default(307200),
  VIDEO_MAX_HEIGHT: Joi.number().integer().positive().default(720),
  VIDEO_CRF: Joi.number().integer().min(0).max(51).default(28),
  VIDEO_SKIP_BELOW_BYTES: Joi.number().integer().positive().default(5242880),
  VIDEO_TRANSCODE_TIMEOUT_MS: Joi.number().integer().positive().default(120000),
  OWNER_EMAIL: Joi.string().email().allow('').optional(),
  ANDROID_PACKAGE_NAME: Joi.string().allow('').optional(),
  ANDROID_CERT_SHA256: Joi.string().allow('').optional(),
  ANDROID_PACKAGE_NAME_2: Joi.string().allow('').optional(),
  ANDROID_CERT_SHA256_2: Joi.string().allow('').optional(),
  ANDROID_RELATIONS_2: Joi.string().allow('').optional(),
  ANDROID_APPS: Joi.string().allow('').optional(),
  ANDROID_ASSET_LINKS_JSON: Joi.string().allow('').optional(),
  ANDROID_ASSET_LINKS_PATH: Joi.string().allow('').optional(),
  DEV_RUN_WORKER: Joi.boolean().default(false),
  LOG_LEVEL: Joi.string()
    .valid('fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent')
    .default('info'),
  MAIL_PROVIDER: Joi.string().valid('smtp', 'stub').default('stub'),
  MAIL_FROM: Joi.string().optional(),
  MAIL_SMTP_HOST: Joi.string().optional(),
  MAIL_SMTP_PORT: Joi.number().port().optional(),
  MAIL_SMTP_USER: Joi.string().allow('').optional(),
  MAIL_SMTP_PASS: Joi.string().allow('').optional(),
  SMTP_FROM: Joi.string().optional(),
  SMTP_HOST: Joi.string().optional(),
  SMTP_PORT: Joi.number().port().optional(),
  SMTP_USER: Joi.string().allow('').optional(),
  SMTP_PASS: Joi.string().allow('').optional(),
  PASSWORD_RESET_CODE_TTL_SEC: Joi.number().integer().positive().default(600),
  PASSWORD_RESET_TOKEN_TTL_SEC: Joi.number().integer().positive().default(900),
  PASSWORD_RESET_MAX_ATTEMPTS: Joi.number().integer().positive().default(5),
  PASSWORD_RESET_MAX_REQUESTS_PER_HOUR: Joi.number().integer().positive().default(3),
  CORS_ORIGINS: Joi.string().allow('').optional()
}).custom((value, helpers) => {
  if (value.PUSH_PROVIDER !== 'fcm') return value;

  const hasServiceAccountFile = Boolean(value.FIREBASE_SERVICE_ACCOUNT_PATH?.trim());
  const hasInlineCredentials =
    Boolean(value.FIREBASE_CLIENT_EMAIL?.trim()) && Boolean(value.FIREBASE_PRIVATE_KEY?.trim());

  if (!value.FIREBASE_PROJECT_ID?.trim()) {
    return helpers.error('any.custom', { message: 'FIREBASE_PROJECT_ID is required when PUSH_PROVIDER=fcm' });
  }
  if (!hasServiceAccountFile && !hasInlineCredentials) {
    return helpers.error('any.custom', {
      message:
        'FCM requires FIREBASE_SERVICE_ACCOUNT_PATH or both FIREBASE_CLIENT_EMAIL and FIREBASE_PRIVATE_KEY'
    });
  }
  if (!hasServiceAccountFile && value.FIREBASE_CLIENT_EMAIL?.trim()) {
    const { error } = Joi.string().email().validate(value.FIREBASE_CLIENT_EMAIL);
    if (error) {
      return helpers.error('any.custom', { message: 'FIREBASE_CLIENT_EMAIL must be a valid email' });
    }
  }
  if (value.MAIL_PROVIDER === 'smtp') {
    const from = value.MAIL_FROM?.trim() || value.SMTP_FROM?.trim();
    if (!from) {
      return helpers.error('any.custom', {
        message: 'MAIL_FROM or SMTP_FROM is required when MAIL_PROVIDER=smtp'
      });
    }
    const host = value.MAIL_SMTP_HOST?.trim() || value.SMTP_HOST?.trim();
    if (!host) {
      return helpers.error('any.custom', {
        message: 'MAIL_SMTP_HOST or SMTP_HOST is required when MAIL_PROVIDER=smtp'
      });
    }
  }
  return value;
});
