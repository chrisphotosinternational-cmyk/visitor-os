import cors from '@fastify/cors';
import Fastify, { type FastifyInstance } from 'fastify';
import { registerErrorHandler } from './core/errors/error-handler.js';
import type { AppConfig } from './core/config/env.js';
import type { AppLogger } from './core/logger/logger.js';
import type { Database } from './database/client.js';
import { registerAdminRoutes } from './modules/admin/admin-routes.js';
import { registerWidgetRoutes } from './modules/widget/widget-routes.js';
import { registerSecurityHeaders } from './core/security/security-headers.js';
import { registerSimpleRateLimit } from './core/security/simple-rate-limit.js';
import { createDefaultAiProvider } from './modules/ai/mock-ai-provider.js';
import { createDecisionEngine } from './modules/decision-engine/decision-engine.js';
import {
  createBusinessConfigEngine,
  type BusinessConfigEngine
} from './modules/business-config/configuration-loader.js';
import { AuthService } from './modules/auth/auth-service.js';

export type AppDependencies = {
  config: AppConfig;
  database: Database;
  logger: AppLogger;
  businessConfigEngine?: BusinessConfigEngine;
};

export async function createApp(dependencies: AppDependencies): Promise<FastifyInstance> {
  const app = Fastify({
    loggerInstance: dependencies.logger
  });

  await app.register(cors, {
    credentials: true,
    origin:
      dependencies.config.security.allowedOrigins.length > 0
        ? dependencies.config.security.allowedOrigins
        : dependencies.config.app.environment === 'production'
          ? false
          : true
  });

  registerSecurityHeaders(app);
  registerSimpleRateLimit(app, {
    windowMs: dependencies.config.security.rateLimitWindowMs,
    maxRequests: dependencies.config.security.rateLimitMaxRequests
  });

  registerErrorHandler(app);

  app.get('/health', () => ({
    status: 'ok',
    app: dependencies.config.app.name,
    environment: dependencies.config.app.environment
  }));

  const businessConfigEngine =
    dependencies.businessConfigEngine ??
    createBusinessConfigEngine({
      configDirectory: dependencies.config.businessConfig.directory
    });
  const aiProvider = createDefaultAiProvider(dependencies.config.ai.openAiApiKey);
  const decisionEngine = createDecisionEngine({ aiProvider, businessConfigEngine });
  const authService = new AuthService(dependencies.database, dependencies.config);

  registerWidgetRoutes(app, dependencies.database, decisionEngine);
  registerAdminRoutes(app, dependencies.database, businessConfigEngine, authService);

  return app;
}
