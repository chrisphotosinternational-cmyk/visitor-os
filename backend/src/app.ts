import cors from '@fastify/cors';
import Fastify, { type FastifyInstance, type FastifyRequest } from 'fastify';
import { registerErrorHandler } from './core/errors/error-handler.js';
import type { AppConfig } from './core/config/env.js';
import type { AppLogger } from './core/logger/logger.js';
import type { Database } from './database/client.js';
import { registerAdminRoutes } from './modules/admin/admin-routes.js';
import { registerAdminManagementRoutes } from './modules/admin-management/admin-management-routes.js';
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
import { AppCache } from './core/cache/app-cache.js';
import { InMemoryJobQueue } from './core/jobs/in-memory-job-queue.js';
import { renderMetrics } from './core/monitoring/metrics.js';
import { writeFileLog } from './core/logger/file-logger.js';
import { registerTraceContext } from './core/observability/trace-context.js';
import { AuditTrailService, actionFromRequest } from './modules/audit/audit-trail-service.js';
import { verifyJwt } from './modules/auth/jwt.js';

export type AppDependencies = {
  config: AppConfig;
  database: Database;
  logger: AppLogger;
  businessConfigEngine?: BusinessConfigEngine;
  readiness?: {
    database: 'disabled' | 'pending' | 'ok' | 'error';
  };
  cache?: AppCache;
  queue?: InMemoryJobQueue;
  startedAt?: Date;
};

export async function createApp(dependencies: AppDependencies): Promise<FastifyInstance> {
  const app = Fastify({
    loggerInstance: dependencies.logger
  });
  const cache =
    dependencies.cache ??
    new AppCache({
      enabled: dependencies.config.cache?.enabled ?? true,
      defaultTtlMs: dependencies.config.cache?.ttlMs ?? 30000
    });
  const queue = dependencies.queue ?? new InMemoryJobQueue();
  const startedAt = dependencies.startedAt ?? new Date();
  const auditTrail = new AuditTrailService(dependencies.database);

  registerTraceContext(app);
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
  registerFileLogging(app, dependencies.config);
  registerAuditTrail(app, dependencies.config, auditTrail);
  registerFrontendAdmin(app);

  const runtimeEnvironment = () => process.env.NODE_ENV ?? 'development';
  const runtimeVersion = () => process.env.APP_VERSION ?? 'dev';

  app.get('/health', () => ({
    status: 'ok',
    app: dependencies.config.app.name,
    version: runtimeVersion(),
    environment: runtimeEnvironment(),
    database:
      dependencies.readiness?.database ??
      (dependencies.database.isConfigured() ? 'ok' : 'disabled'),
    openTelemetry: {
      enabled: dependencies.config.observability?.openTelemetryEnabled ?? true,
      serviceName: dependencies.config.observability?.serviceName ?? 'visitor-os-backend'
    },
    cache: cache.stats(),
    queue: queue.stats(),
    disk: {
      logs: dependencies.config.fileLogs?.enabled ? 'enabled' : 'disabled'
    },
    uptime: Math.round(process.uptime())
  }));

  app.get('/live', () => ({
    status: 'alive',
    app: dependencies.config.app.name,
    version: runtimeVersion(),
    environment: runtimeEnvironment()
  }));

  app.get('/ready', () => {
    return {
      status: 'ready',
      app: dependencies.config.app.name,
      version: runtimeVersion(),
      database: dependencies.readiness?.database ?? 'ok'
    };
  });

  app.get('/metrics', (_request, reply) => {
    reply.type('text/plain; version=0.0.4; charset=utf-8');

    return renderMetrics({
      app: dependencies.config.app.name,
      environment: runtimeEnvironment(),
      uptimeSeconds: Math.round((Date.now() - startedAt.getTime()) / 1000),
      database: dependencies.readiness?.database ?? 'ok',
      cache,
      queue
    });
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
  registerAdminManagementRoutes(app, dependencies.database, dependencies.config, { cache, queue });
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

function registerFileLogging(app: FastifyInstance, config: AppConfig): void {
  const fileLogs = config.fileLogs ?? {
    enabled: false,
    directory: 'logs',
    maxBytes: 5_000_000
  };

  app.addHook('onError', (request, _reply, error, done) => {
    void writeFileLog(fileLogs, 'error', {
      method: request.method,
      url: request.url,
      name: error.name,
      message: error.message,
      stack: error.stack
    });
    done();
  });

  app.addHook('onResponse', (request, reply, done) => {
    void writeFileLog(fileLogs, 'application', {
      method: request.method,
      url: request.url,
      statusCode: reply.statusCode,
      responseTimeMs: Math.round(reply.elapsedTime)
    });

    if (request.url.startsWith('/admin-api') || request.url.startsWith('/api/admin')) {
      void writeFileLog(fileLogs, 'audit', {
        method: request.method,
        url: request.url,
        statusCode: reply.statusCode
      });
    }

    done();
  });
}

function registerAuditTrail(
  app: FastifyInstance,
  config: AppConfig,
  auditTrail: AuditTrailService
): void {
  app.addHook('onResponse', (request, reply, done) => {
    const isMutation = ['POST', 'PUT', 'PATCH', 'DELETE'].includes(request.method);
    const isAdminRoute =
      request.url.startsWith('/admin-api') || request.url.startsWith('/api/admin');

    if (isMutation && isAdminRoute && reply.statusCode < 400) {
      const action = actionFromRequest(request);
      const user = readJwtUser(request, config);
      const auditEntry = {
        organizationId: user?.organizationId ?? null,
        userId: user?.sub ?? null,
        action: action.action,
        resource: action.resource,
        after: {
          method: request.method,
          statusCode: reply.statusCode
        },
        request
      };

      void auditTrail.safeRecord(
        action.resourceId ? { ...auditEntry, resourceId: action.resourceId } : auditEntry
      );
    }

    done();
  });
}

function readJwtUser(request: FastifyRequest, config: AppConfig) {
  const authorization = request.headers.authorization;
  if (!authorization?.startsWith('Bearer ')) return null;

  try {
    return verifyJwt(authorization.slice('Bearer '.length).trim(), config.auth.sessionSecret);
  } catch {
    return null;
  }
}
