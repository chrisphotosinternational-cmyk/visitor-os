import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { AppError } from '../../core/errors/app-error.js';
import type { Database } from '../../database/client.js';
import {
  ConversationRepository,
  conversationStatuses
} from '../conversations/conversation-repository.js';
import { ProspectRepository, prospectStatuses } from '../prospects/prospect-repository.js';
import {
  businessConfigImportPayloadSchema,
  type BusinessConfigEngine
} from '../business-config/configuration-loader.js';
import { buildSystemPrompt } from '../business-config/prompt-builder.js';
import {
  OrganizationRepository,
  organizationStatuses
} from '../organizations/organization-repository.js';
import { SiteRepository, siteStatuses } from '../sites/site-repository.js';
import { userRoles } from '../users/user-model.js';
import type { AuthContext, AuthService } from '../auth/auth-service.js';
import { permissionsForRole } from '../auth/rbac.js';

const organizationInputSchema = z.object({
  name: z.string().min(1),
  slug: z.string().min(1),
  description: z.string().optional(),
  email: z.string().email().optional(),
  phone: z.string().optional(),
  country: z.string().min(2).default('FR'),
  language: z.string().min(2).default('fr'),
  timezone: z.string().min(1).default('Europe/Paris'),
  currency: z.string().min(3).default('EUR'),
  status: z.enum(organizationStatuses).default('active'),
  plan: z.string().optional()
});

const siteInputSchema = z.object({
  organizationId: z.string().uuid(),
  name: z.string().min(1),
  slug: z.string().min(1),
  domain: z.string().optional(),
  widgetPublicKey: z.string().optional(),
  businessConfigId: z.string().min(1),
  language: z.string().min(2).default('fr'),
  status: z.enum(siteStatuses).default('active'),
  widgetEnabled: z.boolean().default(true)
});

const organizationQuerySchema = z.object({
  organizationId: z.string().uuid().optional(),
  search: z.string().optional()
});

export function registerAdminRoutes(
  app: FastifyInstance,
  database: Database,
  businessConfigEngine: BusinessConfigEngine,
  auth: AuthService
): void {
  const prospects = new ProspectRepository(database);
  const conversations = new ConversationRepository(database);
  const organizations = new OrganizationRepository(database);
  const sites = new SiteRepository(database);
  const authContexts = new WeakMap<object, AuthContext>();

  app.post('/api/admin/auth/login', async (request, reply) => {
    const body = z
      .object({
        email: z.string().email(),
        password: z.string().min(1)
      })
      .parse(request.body);
    const user = await auth.login({ ...body, reply });

    return { user, permissions: permissionsForRole(user.role) };
  });

  app.addHook('preHandler', async (request, reply) => {
    if (!request.url.startsWith('/api/admin')) return;
    if (request.url.startsWith('/api/admin/auth/login')) return;

    authContexts.set(request, await auth.authenticate(request, reply));
  });

  app.post('/api/admin/auth/logout', async (request, reply) => {
    await auth.logout(request, reply);

    return { ok: true };
  });

  app.get('/api/admin/auth/me', (request) => {
    const context = getAuthContext(authContexts, request);

    return { user: context.user, permissions: permissionsForRole(context.user.role) };
  });

  app.get('/api/admin/conversations', async (request) => {
    const context = getAuthContext(authContexts, request);
    auth.requirePermission(context, 'conversations:read');
    const query = organizationQuerySchema.parse(request.query);
    const organizationId = auth.requireOrganizationAccess(context, query.organizationId);

    return {
      conversations: await conversations.listAdminConversations({
        ...(organizationId ? { organizationId } : {}),
        ...(query.search ? { search: query.search } : {})
      }),
      statuses: conversationStatuses
    };
  });

  app.get('/api/admin/conversations/:conversationId', async (request) => {
    const context = getAuthContext(authContexts, request);
    auth.requirePermission(context, 'conversations:read');
    const params = z.object({ conversationId: z.string().uuid() }).parse(request.params);
    const query = z.object({ organizationId: z.string().uuid().optional() }).parse(request.query);
    const organizationId = auth.requireOrganizationAccess(context, query.organizationId);
    const conversation = await conversations.findAdminConversation(
      params.conversationId,
      organizationId
    );

    if (!conversation) {
      throw new AppError('Conversation not found', {
        statusCode: 404,
        code: 'CONVERSATION_NOT_FOUND'
      });
    }

    return { conversation, statuses: conversationStatuses };
  });

  app.patch('/api/admin/conversations/:conversationId/status', async (request) => {
    const context = getAuthContext(authContexts, request);
    auth.requirePermission(context, 'conversations:write');
    const params = z.object({ conversationId: z.string().uuid() }).parse(request.params);
    const body = z.object({ status: z.enum(conversationStatuses) }).parse(request.body);
    const existing = await conversations.findConversation(params.conversationId);
    if (!existing) {
      throw new AppError('Conversation not found', {
        statusCode: 404,
        code: 'CONVERSATION_NOT_FOUND'
      });
    }
    auth.requireOrganizationAccess(context, existing.organization_id);
    const conversation = await conversations.updateStatus(params.conversationId, body.status);

    if (!conversation) {
      throw new AppError('Conversation not found', {
        statusCode: 404,
        code: 'CONVERSATION_NOT_FOUND'
      });
    }

    return { conversation };
  });

  app.get('/api/admin/prospects', async (request) => {
    const context = getAuthContext(authContexts, request);
    auth.requirePermission(context, 'prospects:read');
    const query = z.object({ organizationId: z.string().uuid().optional() }).parse(request.query);
    const organizationId = auth.requireOrganizationAccess(context, query.organizationId);

    return {
      prospects: await prospects.list(organizationId),
      statuses: prospectStatuses
    };
  });

  app.get('/api/admin/organizations', async (request) => {
    const context = getAuthContext(authContexts, request);
    auth.requirePermission(context, 'organizations:read');

    return {
      organizations:
        context.user.role === 'SuperAdmin'
          ? await organizations.list()
          : optionalArray(await organizations.find(context.user.organizationId)),
      statuses: organizationStatuses,
      roles: userRoles
    };
  });

  app.post('/api/admin/organizations', async (request) => {
    const context = getAuthContext(authContexts, request);
    auth.requirePermission(context, 'organizations:write');
    const body = organizationInputSchema.parse(request.body);

    return {
      organization: await organizations.create(toOrganizationInput(body)),
      statuses: organizationStatuses
    };
  });

  app.get('/api/admin/organizations/:organizationId', async (request) => {
    const context = getAuthContext(authContexts, request);
    auth.requirePermission(context, 'organizations:read');
    const params = z.object({ organizationId: z.string().uuid() }).parse(request.params);
    auth.requireOrganizationAccess(context, params.organizationId);
    const organization = await organizations.find(params.organizationId);

    if (!organization) {
      throw new AppError('Organization not found', {
        statusCode: 404,
        code: 'ORGANIZATION_NOT_FOUND'
      });
    }

    return { organization, export: { organization } };
  });

  app.put('/api/admin/organizations/:organizationId', async (request) => {
    const context = getAuthContext(authContexts, request);
    auth.requirePermission(context, 'organizations:write');
    const params = z.object({ organizationId: z.string().uuid() }).parse(request.params);
    const body = organizationInputSchema.parse(request.body);
    const organization = await organizations.update(
      params.organizationId,
      toOrganizationInput(body)
    );

    if (!organization) {
      throw new AppError('Organization not found', {
        statusCode: 404,
        code: 'ORGANIZATION_NOT_FOUND'
      });
    }

    return { organization };
  });

  app.patch('/api/admin/organizations/:organizationId/status', async (request) => {
    const context = getAuthContext(authContexts, request);
    auth.requirePermission(context, 'organizations:write');
    const params = z.object({ organizationId: z.string().uuid() }).parse(request.params);
    const body = z.object({ status: z.enum(organizationStatuses) }).parse(request.body);
    const organization = await organizations.updateStatus(params.organizationId, body.status);

    if (!organization) {
      throw new AppError('Organization not found', {
        statusCode: 404,
        code: 'ORGANIZATION_NOT_FOUND'
      });
    }

    return { organization };
  });

  app.delete('/api/admin/organizations/:organizationId', async (request) => {
    const context = getAuthContext(authContexts, request);
    auth.requirePermission(context, 'organizations:write');
    const params = z.object({ organizationId: z.string().uuid() }).parse(request.params);

    return { deleted: await organizations.delete(params.organizationId) };
  });

  app.get('/api/admin/sites', async (request) => {
    const context = getAuthContext(authContexts, request);
    auth.requirePermission(context, 'sites:read');
    const query = z.object({ organizationId: z.string().uuid().optional() }).parse(request.query);
    const organizationId = auth.requireOrganizationAccess(context, query.organizationId);

    return {
      sites: await sites.list(organizationId),
      statuses: siteStatuses
    };
  });

  app.post('/api/admin/sites', async (request) => {
    const context = getAuthContext(authContexts, request);
    auth.requirePermission(context, 'sites:write');
    const body = siteInputSchema.parse(request.body);
    auth.requireOrganizationAccess(context, body.organizationId);

    return {
      site: await sites.create(toSiteInput(body)),
      statuses: siteStatuses
    };
  });

  app.get('/api/admin/sites/:siteId', async (request) => {
    const context = getAuthContext(authContexts, request);
    auth.requirePermission(context, 'sites:read');
    const params = z.object({ siteId: z.string().uuid() }).parse(request.params);
    const site = await sites.find(params.siteId);

    if (!site) {
      throw new AppError('Site not found', { statusCode: 404, code: 'SITE_NOT_FOUND' });
    }
    auth.requireOrganizationAccess(context, site.organization_id);

    const config = await businessConfigEngine.resolveConfig(site.business_config_id);

    return { site, config, export: { site, config } };
  });

  app.put('/api/admin/sites/:siteId', async (request) => {
    const context = getAuthContext(authContexts, request);
    auth.requirePermission(context, 'sites:write');
    const params = z.object({ siteId: z.string().uuid() }).parse(request.params);
    const body = siteInputSchema.parse(request.body);
    auth.requireOrganizationAccess(context, body.organizationId);
    const site = await sites.update(params.siteId, toSiteInput(body));

    if (!site) {
      throw new AppError('Site not found', { statusCode: 404, code: 'SITE_NOT_FOUND' });
    }

    return { site };
  });

  app.patch('/api/admin/sites/:siteId/status', async (request) => {
    const context = getAuthContext(authContexts, request);
    auth.requirePermission(context, 'sites:write');
    const params = z.object({ siteId: z.string().uuid() }).parse(request.params);
    const body = z.object({ status: z.enum(siteStatuses) }).parse(request.body);
    const existing = await sites.find(params.siteId);
    if (!existing) {
      throw new AppError('Site not found', { statusCode: 404, code: 'SITE_NOT_FOUND' });
    }
    auth.requireOrganizationAccess(context, existing.organization_id);
    const site = await sites.updateStatus(params.siteId, body.status);

    if (!site) {
      throw new AppError('Site not found', { statusCode: 404, code: 'SITE_NOT_FOUND' });
    }

    return { site };
  });

  app.delete('/api/admin/sites/:siteId', async (request) => {
    const context = getAuthContext(authContexts, request);
    auth.requirePermission(context, 'sites:write');
    const params = z.object({ siteId: z.string().uuid() }).parse(request.params);
    const site = await sites.find(params.siteId);
    if (!site) {
      throw new AppError('Site not found', { statusCode: 404, code: 'SITE_NOT_FOUND' });
    }
    auth.requireOrganizationAccess(context, site.organization_id);

    return { deleted: await sites.delete(params.siteId) };
  });

  app.get('/api/admin/prospects/:prospectId', async (request) => {
    const context = getAuthContext(authContexts, request);
    auth.requirePermission(context, 'prospects:read');
    const params = z.object({ prospectId: z.string().uuid() }).parse(request.params);
    const query = z.object({ organizationId: z.string().uuid().optional() }).parse(request.query);
    const organizationId = auth.requireOrganizationAccess(context, query.organizationId);
    const prospect = await prospects.findDetail(params.prospectId, organizationId);

    if (!prospect) {
      throw new AppError('Prospect not found', { statusCode: 404, code: 'PROSPECT_NOT_FOUND' });
    }

    return { prospect, statuses: prospectStatuses };
  });

  app.patch('/api/admin/prospects/:prospectId/status', async (request) => {
    const context = getAuthContext(authContexts, request);
    auth.requirePermission(context, 'prospects:write');
    const params = z.object({ prospectId: z.string().uuid() }).parse(request.params);
    const body = z.object({ status: z.enum(prospectStatuses) }).parse(request.body);
    const existing = await prospects.findDetail(
      params.prospectId,
      auth.requireOrganizationAccess(context)
    );
    if (!existing) {
      throw new AppError('Prospect not found', { statusCode: 404, code: 'PROSPECT_NOT_FOUND' });
    }
    const prospect = await prospects.updateStatus(params.prospectId, body.status);

    if (!prospect) {
      throw new AppError('Prospect not found', { statusCode: 404, code: 'PROSPECT_NOT_FOUND' });
    }

    return { prospect };
  });

  app.get('/api/admin/configs', async (request) => {
    const context = getAuthContext(authContexts, request);
    auth.requirePermission(context, 'settings:access');

    return { configs: await businessConfigEngine.list() };
  });

  app.get('/api/admin/configs/:configId', async (request) => {
    const context = getAuthContext(authContexts, request);
    auth.requirePermission(context, 'settings:access');
    const params = z.object({ configId: z.string().min(1) }).parse(request.params);
    const config = await businessConfigEngine.getConfig(params.configId);

    return {
      config,
      prompt: buildSystemPrompt(config),
      history: await businessConfigEngine.listHistory(params.configId)
    };
  });

  app.put('/api/admin/configs/:configId', async (request) => {
    const context = getAuthContext(authContexts, request);
    auth.requirePermission(context, 'settings:access');
    const params = z.object({ configId: z.string().min(1) }).parse(request.params);
    const body = businessConfigImportPayloadSchema.parse(request.body);
    const config = await businessConfigEngine.saveConfig({
      id: params.configId,
      config: body.config,
      ...(body.author ? { author: body.author } : {}),
      ...(body.comment ? { comment: body.comment } : {})
    });

    return {
      config,
      prompt: buildSystemPrompt(config),
      history: await businessConfigEngine.listHistory(params.configId)
    };
  });

  app.post('/api/admin/configs/import', async (request) => {
    const context = getAuthContext(authContexts, request);
    auth.requirePermission(context, 'settings:access');
    const body = businessConfigImportPayloadSchema.parse(request.body);
    const config = await businessConfigEngine.importConfig({
      config: body.config,
      ...(body.author ? { author: body.author } : {}),
      ...(body.comment ? { comment: body.comment } : {})
    });

    return {
      config,
      prompt: buildSystemPrompt(config),
      history: await businessConfigEngine.listHistory(config.id)
    };
  });

  app.post('/api/admin/configs/reload', async (request) => {
    const context = getAuthContext(authContexts, request);
    auth.requirePermission(context, 'settings:access');

    await businessConfigEngine.reload();

    return {
      configs: await businessConfigEngine.list()
    };
  });

  app.get('/api/admin/configs/:configId/export', async (request) => {
    const context = getAuthContext(authContexts, request);
    auth.requirePermission(context, 'data:export');
    const params = z.object({ configId: z.string().min(1) }).parse(request.params);

    return {
      config: await businessConfigEngine.exportConfig(params.configId)
    };
  });
}

function getAuthContext(contexts: WeakMap<object, AuthContext>, request: object): AuthContext {
  const context = contexts.get(request);
  if (!context) {
    throw new AppError('Authentication required', { statusCode: 401, code: 'AUTH_REQUIRED' });
  }

  return context;
}

function optionalArray<T>(value: T | null): T[] {
  return value ? [value] : [];
}

function toOrganizationInput(input: z.infer<typeof organizationInputSchema>) {
  return {
    name: input.name,
    slug: input.slug,
    country: input.country,
    language: input.language,
    timezone: input.timezone,
    currency: input.currency,
    status: input.status,
    ...(input.description ? { description: input.description } : {}),
    ...(input.email ? { email: input.email } : {}),
    ...(input.phone ? { phone: input.phone } : {}),
    ...(input.plan ? { plan: input.plan } : {})
  };
}

function toSiteInput(input: z.infer<typeof siteInputSchema>) {
  return {
    organizationId: input.organizationId,
    name: input.name,
    slug: input.slug,
    businessConfigId: input.businessConfigId,
    language: input.language,
    status: input.status,
    widgetEnabled: input.widgetEnabled,
    ...(input.domain ? { domain: input.domain } : {}),
    ...(input.widgetPublicKey ? { widgetPublicKey: input.widgetPublicKey } : {})
  };
}
