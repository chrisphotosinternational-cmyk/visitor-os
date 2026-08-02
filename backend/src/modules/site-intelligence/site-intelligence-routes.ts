import { timingSafeEqual } from 'node:crypto';
import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { AppError } from '../../core/errors/app-error.js';
import type { SiteIntelligenceService } from './site-intelligence-service.js';

const querySchema = z.object({
  organizationId: z.string().uuid(),
  refresh: z.enum(['true', 'false']).default('false')
}).strict();

const paramsSchema = z.object({ siteId: z.string().uuid() }).strict();

export function registerSiteIntelligenceDebugRoutes(
  app: FastifyInstance,
  service: SiteIntelligenceService,
  token: string
): void {
  app.get('/api/internal/site-intelligence/:siteId', async (request) => {
    assertToken(request.headers.authorization, token);
    const params = paramsSchema.parse(request.params);
    const query = querySchema.parse(request.query);
    const input = { organizationId: query.organizationId, siteId: params.siteId };
    const report =
      query.refresh === 'true' ? await service.analyzeAndStore(input) : await service.latest(input);
    if (!report) {
      throw new AppError('Site intelligence report not found', {
        statusCode: 404,
        code: 'SITE_INTELLIGENCE_REPORT_NOT_FOUND'
      });
    }
    return report;
  });
}

function assertToken(authorization: string | undefined, expected: string): void {
  const supplied = authorization?.startsWith('Bearer ') ? authorization.slice(7) : '';
  const suppliedBuffer = Buffer.from(supplied);
  const expectedBuffer = Buffer.from(expected);
  if (
    suppliedBuffer.length !== expectedBuffer.length ||
    !timingSafeEqual(suppliedBuffer, expectedBuffer)
  ) {
    throw new AppError('Invalid site intelligence debug token', {
      statusCode: 401,
      code: 'SITE_INTELLIGENCE_DEBUG_UNAUTHORIZED'
    });
  }
}
