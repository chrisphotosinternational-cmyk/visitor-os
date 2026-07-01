import 'dotenv/config';
import { z } from 'zod';

const environmentSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  APP_NAME: z.string().min(1).default('VISITOR-OS'),
  HOST: z.string().min(1).default('0.0.0.0'),
  PORT: z.coerce.number().int().positive().max(65535).default(3000),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent']).default('info'),
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
  SHUTDOWN_TIMEOUT_MS: z.coerce.number().int().positive().default(10000)
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

  return {
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
      allowedOrigins: env.ALLOWED_ORIGINS
    }
  };
}
