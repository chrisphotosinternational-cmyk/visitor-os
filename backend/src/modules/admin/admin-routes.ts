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

export function registerAdminRoutes(
  app: FastifyInstance,
  database: Database,
  businessConfigEngine: BusinessConfigEngine
): void {
  const prospects = new ProspectRepository(database);
  const conversations = new ConversationRepository(database);

  app.get('/api/admin/conversations', async (request) => {
    const query = z.object({ search: z.string().optional() }).parse(request.query);

    return {
      conversations: await conversations.listAdminConversations(query.search),
      statuses: conversationStatuses
    };
  });

  app.get('/api/admin/conversations/:conversationId', async (request) => {
    const params = z.object({ conversationId: z.string().uuid() }).parse(request.params);
    const conversation = await conversations.findAdminConversation(params.conversationId);

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

  app.get('/api/admin/prospects', async () => ({
    prospects: await prospects.list(),
    statuses: prospectStatuses
  }));

  app.get('/api/admin/prospects/:prospectId', async (request) => {
    const params = z.object({ prospectId: z.string().uuid() }).parse(request.params);
    const prospect = await prospects.findDetail(params.prospectId);

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
