import { access, readFile } from 'node:fs/promises';
import { dirname, join, normalize, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';

const staticFiles = new Map([
  ['/app.js', { file: 'app.js', contentType: 'application/javascript; charset=utf-8' }],
  ['/config.js', { file: 'config.js', contentType: 'application/javascript; charset=utf-8' }],
  ['/styles.css', { file: 'styles.css', contentType: 'text/css; charset=utf-8' }]
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
  app.get('/', async (_request, reply) => {
    await sendAdminFile(reply, 'index.html', 'text/html; charset=utf-8');
  });

  for (const [route, asset] of staticFiles) {
    app.get(route, async (_request, reply) => {
      await sendAdminFile(reply, asset.file, asset.contentType);
    });
  }

  app.setNotFoundHandler(async (request, reply) => {
    if (shouldServeSpaFallback(request)) {
      await sendAdminFile(reply, 'index.html', 'text/html; charset=utf-8');
      return;
    }

    await reply.status(404).send({
      message: `Route ${request.method}:${request.url} not found`,
      error: 'Not Found',
      statusCode: 404
    });
  });
}

async function sendAdminFile(
  reply: FastifyReply,
  fileName: string,
  contentType: string
): Promise<void> {
  const directory = await resolveFrontendAdminDirectory();
  const filePath = resolve(directory, normalize(fileName));

  if (!filePath.startsWith(directory)) {
    await reply.status(404).send({ error: 'Not Found' });
    return;
  }

  const content = await readFile(filePath);
  await reply.type(contentType).send(content);
}

function shouldServeSpaFallback(request: FastifyRequest): boolean {
  if (request.method !== 'GET') return false;
  const path = request.url.split('?')[0] ?? '/';
  if (reservedPaths.has(path)) return false;

  return !reservedPrefixes.some((prefix) => path.startsWith(prefix));
}

async function resolveFrontendAdminDirectory(): Promise<string> {
  const currentDirectory = dirname(fileURLToPath(import.meta.url));
  const candidates = [
    resolve(process.cwd(), '../frontend-admin'),
    resolve(process.cwd(), 'frontend-admin'),
    resolve(currentDirectory, '../../../../frontend-admin'),
    resolve(currentDirectory, '../../../frontend-admin'),
    resolve(currentDirectory, '../../frontend-admin')
  ];

  for (const candidate of candidates) {
    try {
      await access(join(candidate, 'index.html'));
      return candidate;
    } catch {
      // Try the next runtime layout.
    }
  }

  throw new Error('frontend-admin static directory was not found');
}
