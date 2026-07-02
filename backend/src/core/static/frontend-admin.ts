import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import {
  adminAppJs,
  adminConfigJs,
  adminIndexHtml,
  adminStylesCss
} from './frontend-admin-assets.js';

const staticFiles = new Map([
  ['/app.js', { body: adminAppJs, contentType: 'application/javascript; charset=utf-8' }],
  ['/config.js', { body: adminConfigJs, contentType: 'application/javascript; charset=utf-8' }],
  ['/styles.css', { body: adminStylesCss, contentType: 'text/css; charset=utf-8' }]
]);

const reservedPrefixes = ['/api/', '/api'];
const reservedPaths = new Set([
  '/health',
  '/live',
  '/ready',
  '/login',
  '/logout',
  '/me',
  '/dashboard'
]);

export function registerFrontendAdmin(app: FastifyInstance): void {
  app.get('/', (_request, reply) => {
    sendText(reply, adminIndexHtml, 'text/html; charset=utf-8');
  });

  for (const [route, asset] of staticFiles) {
    app.get(route, (_request, reply) => {
      sendText(reply, asset.body, asset.contentType);
    });
  }

  app.setNotFoundHandler((request, reply) => {
    if (shouldServeSpaFallback(request)) {
      sendText(reply, adminIndexHtml, 'text/html; charset=utf-8');
      return;
    }

    void reply.status(404).send({
      message: `Route ${request.method}:${request.url} not found`,
      error: 'Not Found',
      statusCode: 404
    });
  });
}

function sendText(reply: FastifyReply, body: string, contentType: string): void {
  void reply.type(contentType).send(body);
}

function shouldServeSpaFallback(request: FastifyRequest): boolean {
  if (request.method !== 'GET') return false;
  const path = request.url.split('?')[0] ?? '/';
  if (reservedPaths.has(path)) return false;

  return !reservedPrefixes.some((prefix) => path.startsWith(prefix));
}
