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
  businessConfigEngine: BusinessConfigEngine
): void {
  const prospects = new ProspectRepository(database);
  const conversations = new ConversationRepository(database);
  const organizations = new OrganizationRepository(database);
  const sites = new SiteRepository(database);

  app.get('/api/admin/conversations', async (request) => {
    const query = organizationQuerySchema.parse(request.query);

    return {
      conversations: await conversations.listAdminConversations({
        ...(query.organizationId ? { organizationId: query.organizationId } : {}),
        ...(query.search ? { search: query.search } : {})
      }),
      statuses: conversationStatuses
    };
  });

  app.get('/api/admin/conversations/:conversationId', async (request) => {
    const params = z.object({ conversationId: z.string().uuid() }).parse(request.params);
    const query = z.object({ organizationId: z.string().uuid().optional() }).parse(request.query);
    const conversation = await conversations.findAdminConversation(
      params.conversationId,
      query.organizationId
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
    const params = z.object({ conversationId: z.string().uuid() }).parse(request.params);
    const body = z.object({ status: z.enum(conversationStatuses) }).parse(request.body);
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
    const query = z.object({ organizationId: z.string().uuid().optional() }).parse(request.query);

    return {
      prospects: await prospects.list(query.organizationId),
      statuses: prospectStatuses
    };
  });

  app.get('/api/admin/organizations', async () => ({
    organizations: await organizations.list(),
    statuses: organizationStatuses,
    roles: userRoles
  }));

  app.post('/api/admin/organizations', async (request) => {
    const body = organizationInputSchema.parse(request.body);

    return {
      organization: await organizations.create(toOrganizationInput(body)),
      statuses: organizationStatuses
    };
  });

  app.get('/api/admin/organizations/:organizationId', async (request) => {
    const params = z.object({ organizationId: z.string().uuid() }).parse(request.params);
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
    const params = z.object({ organizationId: z.string().uuid() }).parse(request.params);

    return { deleted: await organizations.delete(params.organizationId) };
  });

  app.get('/api/admin/sites', async (request) => {
    const query = z.object({ organizationId: z.string().uuid().optional() }).parse(request.query);

    return {
      sites: await sites.list(query.organizationId),
      statuses: siteStatuses
    };
  });

  app.post('/api/admin/sites', async (request) => {
    const body = siteInputSchema.parse(request.body);

    return {
      site: await sites.create(toSiteInput(body)),
      statuses: siteStatuses
    };
  });

  app.get('/api/admin/sites/:siteId', async (request) => {
    const params = z.object({ siteId: z.string().uuid() }).parse(request.params);
    const site = await sites.find(params.siteId);

    if (!site) {
      throw new AppError('Site not found', { statusCode: 404, code: 'SITE_NOT_FOUND' });
    }

    const config = await businessConfigEngine.resolveConfig(site.business_config_id);

    return { site, config, export: { site, config } };
  });

  app.put('/api/admin/sites/:siteId', async (request) => {
    const params = z.object({ siteId: z.string().uuid() }).parse(request.params);
    const body = siteInputSchema.parse(request.body);
    const site = await sites.update(params.siteId, toSiteInput(body));

    if (!site) {
      throw new AppError('Site not found', { statusCode: 404, code: 'SITE_NOT_FOUND' });
    }

    return { site };
  });

  app.patch('/api/admin/sites/:siteId/status', async (request) => {
    const params = z.object({ siteId: z.string().uuid() }).parse(request.params);
    const body = z.object({ status: z.enum(siteStatuses) }).parse(request.body);
    const site = await sites.updateStatus(params.siteId, body.status);

    if (!site) {
      throw new AppError('Site not found', { statusCode: 404, code: 'SITE_NOT_FOUND' });
    }

    return { site };
  });

  app.delete('/api/admin/sites/:siteId', async (request) => {
    const params = z.object({ siteId: z.string().uuid() }).parse(request.params);

    return { deleted: await sites.delete(params.siteId) };
  });

  app.get('/api/admin/prospects/:prospectId', async (request) => {
    const params = z.object({ prospectId: z.string().uuid() }).parse(request.params);
    const query = z.object({ organizationId: z.string().uuid().optional() }).parse(request.query);
    const prospect = await prospects.findDetail(params.prospectId, query.organizationId);

    if (!prospect) {
      throw new AppError('Prospect not found', { statusCode: 404, code: 'PROSPECT_NOT_FOUND' });
    }

    return { prospect, statuses: prospectStatuses };
  });

  app.patch('/api/admin/prospects/:prospectId/status', async (request) => {
    const params = z.object({ prospectId: z.string().uuid() }).parse(request.params);
    const body = z.object({ status: z.enum(prospectStatuses) }).parse(request.body);
    const prospect = await prospects.updateStatus(params.prospectId, body.status);

    if (!prospect) {
      throw new AppError('Prospect not found', { statusCode: 404, code: 'PROSPECT_NOT_FOUND' });
    }

    return { prospect };
  });

  app.get('/api/admin/configs', async () => ({
    configs: await businessConfigEngine.list()
  }));

  app.get('/api/admin/configs/:configId', async (request) => {
    const params = z.object({ configId: z.string().min(1) }).parse(request.params);
    const config = await businessConfigEngine.getConfig(params.configId);

    return {
      config,
      prompt: buildSystemPrompt(config),
      history: await businessConfigEngine.listHistory(params.configId)
    };
  });

  app.put('/api/admin/configs/:configId', async (request) => {
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

  app.post('/api/admin/configs/reload', async () => {
    await businessConfigEngine.reload();

    return {
      configs: await businessConfigEngine.list()
    };
  });

  app.get('/api/admin/configs/:configId/export', async (request) => {
    const params = z.object({ configId: z.string().min(1) }).parse(request.params);

    return {
      config: await businessConfigEngine.exportConfig(params.configId)
    };
  });
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
