import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { AppError } from '../../core/errors/app-error.js';
import type { Database } from '../../database/client.js';
import {
  ConversationRepository,
  conversationStatuses
} from '../conversations/conversation-repository.js';
import { ProspectRepository, prospectStatuses } from '../prospects/prospect-repository.js';

export function registerAdminRoutes(app: FastifyInstance, database: Database): void {
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
}
