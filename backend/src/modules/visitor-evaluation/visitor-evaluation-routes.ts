import { timingSafeEqual } from 'node:crypto';
import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { AppError } from '../../core/errors/app-error.js';
import type { VisitorEvaluationService } from './visitor-evaluation-service.js';

const ids = z.object({ siteId: z.string().uuid() }).strict();
const query = z.object({ organizationId: z.string().uuid() }).strict();
const question = z
  .object({
    id: z.string().uuid().optional(),
    organizationId: z.string().uuid(),
    category: z.string().min(1),
    question: z.string().min(1),
    expectedAnswer: z.string().min(1),
    requiredFacts: z.array(z.string().min(1)).default([]),
    forbiddenFacts: z.array(z.string().min(1)).default([]),
    expectedSourcePage: z.string().min(1).nullable().optional(),
    importance: z.number().int().min(1).max(5)
  })
  .strict();

export function registerVisitorEvaluationDebugRoutes(
  app: FastifyInstance,
  service: VisitorEvaluationService,
  token: string
): void {
  app.get('/api/internal/visitor-evaluation/:siteId', async (request) => {
    authorize(request.headers.authorization, token);
    const params = ids.parse(request.params);
    const values = query.parse(request.query);
    return {
      questions: await service.listQuestions({ ...values, ...params }),
      report: await service.latest({ ...values, ...params })
    };
  });
  app.post('/api/internal/visitor-evaluation/:siteId/questions', async (request) => {
    authorize(request.headers.authorization, token);
    const params = ids.parse(request.params);
    const body = question.parse(request.body);
    return service.saveQuestion({
      organizationId: body.organizationId,
      siteId: params.siteId,
      category: body.category,
      question: body.question,
      expectedAnswer: body.expectedAnswer,
      requiredFacts: body.requiredFacts,
      forbiddenFacts: body.forbiddenFacts,
      importance: body.importance as 1 | 2 | 3 | 4 | 5,
      ...(body.id ? { id: body.id } : {}),
      ...(body.expectedSourcePage !== undefined
        ? { expectedSourcePage: body.expectedSourcePage }
        : {})
    });
  });
  app.post('/api/internal/visitor-evaluation/:siteId/run', async (request) => {
    authorize(request.headers.authorization, token);
    const params = ids.parse(request.params);
    const values = query.parse(request.query);
    return service.evaluateAndStore({ ...values, ...params });
  });
}
function authorize(header: string | undefined, expected: string): void {
  const supplied = header?.startsWith('Bearer ') ? header.slice(7) : '';
  const left = Buffer.from(supplied);
  const right = Buffer.from(expected);
  if (left.length !== right.length || !timingSafeEqual(left, right)) {
    throw new AppError('Invalid visitor evaluation debug token', {
      statusCode: 401,
      code: 'VISITOR_EVALUATION_UNAUTHORIZED'
    });
  }
}
