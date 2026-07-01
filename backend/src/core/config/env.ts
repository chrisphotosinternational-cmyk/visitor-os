import 'dotenv/config';
import { z } from 'zod';

const environmentSchema = z
  .object({
    NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
    APP_NAME: z.string().min(1).default('VISITOR-OS'),
    HOST: z.string().min(1).default('0.0.0.0'),
    PORT: z.coerce.number().int().positive().max(65535).default(3000),
    LOG_LEVEL: z
      .enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent'])
      .default('info'),
    DATABASE_URL: z.string().url().startsWith('postgresql://'),
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
    OPENAI_API_KEY: z.string().optional(),
    BUSINESS_CONFIG_DIR: z.string().trim().min(1).default('../configs'),
    ADMIN_SESSION_SECRET: z
      .string()
      .min(32)
      .default('dev-only-session-secret-change-before-production'),
    ADMIN_SESSION_TTL_MS: z.coerce.number().int().positive().default(86_400_000),
    ADMIN_SESSION_RENEWAL_MS: z.coerce.number().int().positive().default(3_600_000),
    FIRST_ADMIN_EMAIL: z.string().email().optional(),
    FIRST_ADMIN_PASSWORD: z.string().min(12).optional(),
    FIRST_ADMIN_FIRST_NAME: z.string().min(1).default('VISITOR'),
    FIRST_ADMIN_LAST_NAME: z.string().min(1).default('Admin'),
    FIRST_ADMIN_ORGANIZATION_ID: z.string().uuid().optional()
  })
  .superRefine((env, context) => {
    if (env.NODE_ENV === 'production' && env.ALLOWED_ORIGINS.length === 0) {
      context.addIssue({
        code: 'custom',
        path: ['ALLOWED_ORIGINS'],
        message: 'must be set in production'
      });
    }

    if (
      env.NODE_ENV === 'production' &&
      env.ADMIN_SESSION_SECRET === 'dev-only-session-secret-change-before-production'
    ) {
      context.addIssue({
        code: 'custom',
        path: ['ADMIN_SESSION_SECRET'],
        message: 'must be changed in production'
      });
    }
  });

export type AppConfig = {
  app: {
    name: string;
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
    url: string;
    ssl: boolean;
    connectionTimeoutMs: number;
  };
  security: {
    allowedOrigins: string[];
    rateLimitWindowMs: number;
    rateLimitMaxRequests: number;
  };
  ai: {
    openAiApiKey?: string;
  };
  businessConfig: {
    directory: string;
  };
  auth: {
    sessionSecret: string;
    sessionTtlMs: number;
    sessionRenewalMs: number;
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
      url: env.DATABASE_URL,
      ssl: env.DATABASE_SSL,
      connectionTimeoutMs: env.DATABASE_CONNECTION_TIMEOUT_MS
    },
    security: {
      allowedOrigins: env.ALLOWED_ORIGINS,
      rateLimitWindowMs: env.RATE_LIMIT_WINDOW_MS,
      rateLimitMaxRequests: env.RATE_LIMIT_MAX_REQUESTS
    },
    ai: {},
    businessConfig: {
      directory: env.BUSINESS_CONFIG_DIR
    },
    auth: {
      sessionSecret: env.ADMIN_SESSION_SECRET,
      sessionTtlMs: env.ADMIN_SESSION_TTL_MS,
      sessionRenewalMs: env.ADMIN_SESSION_RENEWAL_MS
    }
  };

  if (env.OPENAI_API_KEY) {
    config.ai.openAiApiKey = env.OPENAI_API_KEY;
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
