import { randomBytes } from 'node:crypto';
import type { FastifyInstance, FastifyRequest } from 'fastify';

const requestTraceIds = new WeakMap<FastifyRequest, string>();

export function registerTraceContext(app: FastifyInstance): void {
  app.addHook('onRequest', (request, reply, done) => {
    const traceId = incomingTraceId(request) ?? createTraceId();
    requestTraceIds.set(request, traceId);
    reply.header('x-trace-id', traceId);
    done();
  });
}

export function getTraceId(request: FastifyRequest): string {
  return requestTraceIds.get(request) ?? request.id;
}

export function createSpan(
  name: string,
  traceId: string,
  attributes: Record<string, unknown> = {}
) {
  const startedAt = Date.now();

  return {
    end(extraAttributes: Record<string, unknown> = {}) {
      return {
        name,
        traceId,
        durationMs: Date.now() - startedAt,
        attributes: {
          ...attributes,
          ...extraAttributes
        }
      };
    }
  };
}

function incomingTraceId(request: FastifyRequest): string | null {
  const traceparent = request.headers.traceparent;
  if (typeof traceparent !== 'string') return null;
  const [, traceId] = traceparent.split('-');
  return traceId && /^[a-f0-9]{32}$/i.test(traceId) ? traceId : null;
}

function createTraceId(): string {
  return randomBytes(16).toString('hex');
}
