import type { FastifyInstance, FastifyRequest } from 'fastify';
import { AppError } from '../errors/app-error.js';

type RateLimitOptions = {
  windowMs: number;
  maxRequests: number;
};

type Bucket = {
  count: number;
  resetAt: number;
};

export function registerSimpleRateLimit(app: FastifyInstance, options: RateLimitOptions): void {
  const buckets = new Map<string, Bucket>();

  app.addHook('onRequest', (request, _reply, done) => {
    if (request.method === 'OPTIONS' || request.url === '/health') {
      done();
      return;
    }

    const key = getRateLimitKey(request);
    const now = Date.now();
    const bucket = buckets.get(key);

    if (!bucket || bucket.resetAt <= now) {
      buckets.set(key, {
        count: 1,
        resetAt: now + options.windowMs
      });
      done();
      return;
    }

    bucket.count += 1;

    if (bucket.count > options.maxRequests) {
      done(
        new AppError('Too many requests', {
          statusCode: 429,
          code: 'RATE_LIMITED'
        })
      );
      return;
    }

    done();
  });
}

function getRateLimitKey(request: FastifyRequest): string {
  const forwardedFor = request.headers['x-forwarded-for'];
  const ip =
    typeof forwardedFor === 'string' && forwardedFor.trim()
      ? forwardedFor.split(',')[0]?.trim()
      : request.ip;

  return `${ip ?? 'unknown'}:${request.url.split('?')[0] ?? request.url}`;
}
