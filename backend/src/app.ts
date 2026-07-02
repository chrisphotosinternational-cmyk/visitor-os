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
import { registerFrontendAdmin } from './core/static/frontend-admin.js';
import { AIConfigurationRepository } from './modules/ai/ai-configuration-repository.js';
import { ProviderFactory } from './modules/ai/provider-factory.js';
import { createDecisionEngine } from './modules/decision-engine/decision-engine.js';
import {
  createBusinessConfigEngine,
  type BusinessConfigEngine
} from './modules/business-config/configuration-loader.js';
import { AuthService } from './modules/auth/auth-service.js';
import { registerJwtAuthRoutes } from './modules/auth/jwt-auth-routes.js';
import { NotificationRepository } from './modules/notifications/notification-repository.js';
import { NotificationEngine } from './modules/notifications/notification-engine.js';
import { KnowledgeRepository } from './modules/kms/knowledge-repository.js';
import { RepositoryKnowledgeSearch } from './modules/kms/knowledge-search.js';

export type AppDependencies = {
  config: AppConfig;
  database: Database;
  logger: AppLogger;
  businessConfigEngine?: BusinessConfigEngine;
  readiness?: {
    database: 'disabled' | 'pending' | 'ok' | 'error';
  };
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
  registerFrontendAdmin(app);

  app.get('/health', () => ({
    status: 'ok',
    app: dependencies.config.app.name,
    environment: dependencies.config.app.environment
  }));

  app.get('/live', () => ({
    status: 'alive',
    app: dependencies.config.app.name,
    environment: dependencies.config.app.environment
  }));

  app.get('/ready', () => {
    return {
      status: 'ready',
      app: dependencies.config.app.name,
      database: dependencies.readiness?.database ?? 'ok'
    };
  });

  const businessConfigEngine =
    dependencies.businessConfigEngine ??
    createBusinessConfigEngine({
      configDirectory: dependencies.config.businessConfig.directory
    });
  const aiConfigurations = new AIConfigurationRepository(dependencies.database);
  const aiProviderFactory = new ProviderFactory(dependencies.config, aiConfigurations);
  const aiProvider = aiProviderFactory.createProvider();
  const knowledgeRepository = new KnowledgeRepository(dependencies.database);
  const knowledgeSearch = new RepositoryKnowledgeSearch(knowledgeRepository);
  const decisionEngine = createDecisionEngine({
    aiProvider,
    businessConfigEngine,
    knowledgeSearch
  });
  const authService = new AuthService(dependencies.database, dependencies.config);
  const notificationRepository = new NotificationRepository(dependencies.database, {
    retryAttempts: dependencies.config.notifications.retryAttempts,
    timeoutMs: dependencies.config.notifications.timeoutMs
  });
  const notificationEngine = new NotificationEngine(notificationRepository, dependencies.config);

  registerJwtAuthRoutes(app, dependencies.database, dependencies.config);
  registerWidgetRoutes(app, dependencies.database, decisionEngine, notificationEngine);
  registerAdminRoutes(
    app,
    dependencies.database,
    businessConfigEngine,
    authService,
    aiConfigurations,
    aiProviderFactory,
    notificationEngine,
    notificationRepository,
    knowledgeRepository
  );

  return app;
}
