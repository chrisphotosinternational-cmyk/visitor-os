import 'dotenv/config';
import { randomBytes } from 'node:crypto';
import { z } from 'zod';

const DEV_SESSION_SECRET = 'dev-only-session-secret-change-before-production';

const environmentSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  APP_NAME: z.string().min(1).default('VISITOR-OS'),
  APP_VERSION: z.string().min(1).default('1.0.0-beta'),
  HOST: z.string().min(1).default('0.0.0.0'),
  PORT: z.coerce.number().int().positive().max(65535).default(3000),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent']).default('info'),
  DATABASE_URL: z
    .string()
    .trim()
    .optional()
    .refine(
      (value) =>
        !value ||
        ((value.startsWith('postgresql://') || value.startsWith('postgres://')) &&
          z.string().url().safeParse(value).success),
      'must start with postgresql:// or postgres://'
    ),
  DATABASE_SSL: z
    .enum(['true', 'false'])
    .default('false')
    .transform((value) => value === 'true'),
  DATABASE_CONNECTION_TIMEOUT_MS: z.coerce.number().int().positive().default(5000),
  ALLOWED_ORIGINS: z
    .string()
    .default('')
    .transform((value) =>
      value
        .split(',')
        .map((origin) => origin.trim())
        .filter(Boolean)
    ),
  SHUTDOWN_TIMEOUT_MS: z.coerce.number().int().positive().default(10000),
  RATE_LIMIT_WINDOW_MS: z.coerce.number().int().positive().default(60000),
  RATE_LIMIT_MAX_REQUESTS: z.coerce.number().int().positive().default(120),
  CACHE_ENABLED: z
    .enum(['true', 'false'])
    .default('true')
    .transform((value) => value === 'true'),
  CACHE_TTL_MS: z.coerce.number().int().nonnegative().default(30000),
  FILE_LOGS_ENABLED: z
    .enum(['true', 'false'])
    .default('false')
    .transform((value) => value === 'true'),
  FILE_LOGS_DIR: z.string().trim().min(1).default('logs'),
  FILE_LOG_MAX_BYTES: z.coerce.number().int().positive().default(5_000_000),
  OTEL_ENABLED: z
    .enum(['true', 'false'])
    .default('true')
    .transform((value) => value === 'true'),
  OTEL_SERVICE_NAME: z.string().trim().min(1).default('visitor-os-backend'),
  OPENAI_API_KEY: z.string().optional(),
  RESEND_API_KEY: z.string().optional(),
  NOTIFICATION_FROM_EMAIL: z.string().email().default('notifications@visitor-os.local'),
  NOTIFICATION_RETRY_ATTEMPTS: z.coerce.number().int().min(0).max(5).default(2),
  NOTIFICATION_TIMEOUT_MS: z.coerce.number().int().positive().default(5000),
  BUSINESS_CONFIG_DIR: z.string().trim().min(1).default('../configs'),
  ADMIN_SESSION_SECRET: z.string().min(32).default(DEV_SESSION_SECRET),
  ADMIN_SESSION_TTL_MS: z.coerce.number().int().positive().default(86_400_000),
  ADMIN_SESSION_RENEWAL_MS: z.coerce.number().int().positive().default(3_600_000),
  JWT_TTL_SECONDS: z.coerce.number().int().positive().default(3_600),
  FIRST_ADMIN_EMAIL: z.string().email().optional(),
  FIRST_ADMIN_PASSWORD: z.string().min(12).optional(),
  FIRST_ADMIN_FIRST_NAME: z.string().min(1).default('VISITOR'),
  FIRST_ADMIN_LAST_NAME: z.string().min(1).default('Admin'),
  FIRST_ADMIN_ORGANIZATION_ID: z.string().uuid().optional()
});

export type AppConfig = {
  app: {
    name: string;
    version?: string;
    environment: 'development' | 'test' | 'production';
  };
  server: {
    host: string;
    port: number;
    shutdownTimeoutMs: number;
  };
  logger: {
    level: 'fatal' | 'error' | 'warn' | 'info' | 'debug' | 'trace' | 'silent';
  };
  database: {
    url?: string;
    ssl: boolean;
    connectionTimeoutMs: number;
  };
  security: {
    allowedOrigins: string[];
    rateLimitWindowMs: number;
    rateLimitMaxRequests: number;
  };
  cache?: {
    enabled: boolean;
    ttlMs: number;
  };
  fileLogs?: {
    enabled: boolean;
    directory: string;
    maxBytes: number;
  };
  observability?: {
    openTelemetryEnabled: boolean;
    serviceName: string;
  };
  ai: {
    openAiApiKey?: string;
  };
  notifications: {
    resendApiKey?: string;
    fromEmail: string;
    retryAttempts: number;
    timeoutMs: number;
  };
  businessConfig: {
    directory: string;
  };
  auth: {
    sessionSecret: string;
    sessionTtlMs: number;
    sessionRenewalMs: number;
    jwtTtlSeconds: number;
    firstAdmin?: {
      email: string;
      password: string;
      firstName: string;
      lastName: string;
      organizationId?: string;
    };
  };
};

export function loadConfig(source: NodeJS.ProcessEnv): AppConfig {
  const result = environmentSchema.safeParse(source);

  if (!result.success) {
    const details = result.error.issues
      .map((issue) => `${issue.path.join('.')}: ${issue.message}`)
      .join('; ');

    throw new Error(`Invalid environment configuration: ${details}`);
  }

  const env = result.data;

  const config: AppConfig = {
    app: {
      name: env.APP_NAME,
      version: env.APP_VERSION,
      environment: env.NODE_ENV
    },
    server: {
      host: env.HOST,
      port: env.PORT,
      shutdownTimeoutMs: env.SHUTDOWN_TIMEOUT_MS
    },
    logger: {
      level: env.LOG_LEVEL
    },
    database: {
      ...(env.DATABASE_URL ? { url: env.DATABASE_URL } : {}),
      ssl: env.DATABASE_SSL,
      connectionTimeoutMs: env.DATABASE_CONNECTION_TIMEOUT_MS
    },
    security: {
      allowedOrigins: env.ALLOWED_ORIGINS,
      rateLimitWindowMs: env.RATE_LIMIT_WINDOW_MS,
      rateLimitMaxRequests: env.RATE_LIMIT_MAX_REQUESTS
    },
    cache: {
      enabled: env.CACHE_ENABLED,
      ttlMs: env.CACHE_TTL_MS
    },
    fileLogs: {
      enabled: env.FILE_LOGS_ENABLED,
      directory: env.FILE_LOGS_DIR,
      maxBytes: env.FILE_LOG_MAX_BYTES
    },
    observability: {
      openTelemetryEnabled: env.OTEL_ENABLED,
      serviceName: env.OTEL_SERVICE_NAME
    },
    ai: {},
    notifications: {
      fromEmail: env.NOTIFICATION_FROM_EMAIL,
      retryAttempts: env.NOTIFICATION_RETRY_ATTEMPTS,
      timeoutMs: env.NOTIFICATION_TIMEOUT_MS
    },
    businessConfig: {
      directory: env.BUSINESS_CONFIG_DIR
    },
    auth: {
      sessionSecret: resolveSessionSecret(env.NODE_ENV, env.ADMIN_SESSION_SECRET),
      sessionTtlMs: env.ADMIN_SESSION_TTL_MS,
      sessionRenewalMs: env.ADMIN_SESSION_RENEWAL_MS,
      jwtTtlSeconds: env.JWT_TTL_SECONDS
    }
  };

  if (env.OPENAI_API_KEY) {
    config.ai.openAiApiKey = env.OPENAI_API_KEY;
  }

  if (env.RESEND_API_KEY) {
    config.notifications.resendApiKey = env.RESEND_API_KEY;
  }

  if (env.FIRST_ADMIN_EMAIL && env.FIRST_ADMIN_PASSWORD) {
    config.auth.firstAdmin = {
      email: env.FIRST_ADMIN_EMAIL,
      password: env.FIRST_ADMIN_PASSWORD,
      firstName: env.FIRST_ADMIN_FIRST_NAME,
      lastName: env.FIRST_ADMIN_LAST_NAME,
      ...(env.FIRST_ADMIN_ORGANIZATION_ID
        ? { organizationId: env.FIRST_ADMIN_ORGANIZATION_ID }
        : {})
    };
  }

  return config;
}

function resolveSessionSecret(environment: string, secret: string): string {
  if (environment === 'production' && secret === DEV_SESSION_SECRET) {
    return randomBytes(32).toString('base64url');
  }

  return secret;
}
