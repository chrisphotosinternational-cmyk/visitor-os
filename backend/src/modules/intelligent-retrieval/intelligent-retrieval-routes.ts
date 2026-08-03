import { timingSafeEqual } from 'node:crypto';
import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import type { IntelligentRetrievalEngine } from './intelligent-retrieval-engine.js';

const paramsSchema = z.object({ siteId: z.string().uuid() });
const bodySchema = z.object({
  organizationId: z.string().uuid(),
  question: z.string().trim().min(1),
  category: z.string().optional(),
  limit: z.number().int().min(1).max(50).optional()
});

export function registerIntelligentRetrievalDebugRoutes(
  app: FastifyInstance,
  engine: IntelligentRetrievalEngine,
  token: string
): void {
  app.post('/api/internal/intelligent-retrieval/:siteId', async (request, reply) => {
    if (!validToken(request.headers.authorization, token)) {
      return reply.status(401).send({ error: 'Unauthorized' });
    }
    const { siteId } = paramsSchema.parse(request.params);
    const body = bodySchema.parse(request.body);
    return engine.inspect({
      organizationId: body.organizationId,
      siteId,
      query: body.question,
      ...(body.category ? { category: body.category } : {}),
      ...(body.limit ? { limit: body.limit } : {})
    });
  });
}

function validToken(header: string | undefined, expected: string): boolean {
  if (!header?.startsWith('Bearer ')) return false;
  const actual = Buffer.from(header.slice(7));
  const wanted = Buffer.from(expected);
  return actual.length === wanted.length && timingSafeEqual(actual, wanted);
}
