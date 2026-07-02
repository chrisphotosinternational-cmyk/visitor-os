import type { FastifyInstance, FastifyRequest } from 'fastify';
import { z } from 'zod';
import { AppError } from '../../core/errors/app-error.js';
import type { AppConfig } from '../../core/config/env.js';
import type { Database } from '../../database/client.js';
import { UserRepository, type UserRecord } from '../users/user-repository.js';
import { verifyPassword } from './password.js';
import { signJwt, verifyJwt, type JwtAuthContext } from './jwt.js';

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1)
});

export function registerJwtAuthRoutes(
  app: FastifyInstance,
  database: Database,
  config: AppConfig
): void {
  const users = new UserRepository(database);

  app.post('/login', async (request) => {
    const body = loginSchema.parse(request.body);
    const user = await users.findByEmail(body.email);

    if (!user || user.status !== 'active' || !user.password_hash) {
      throw invalidCredentials();
    }

    const validPassword = await verifyPassword(body.password, user.password_hash);
    if (!validPassword) {
      throw invalidCredentials();
    }

    const token = signJwt(toJwtPayload(user), config.auth.sessionSecret, config.auth.jwtTtlSeconds);

    return {
      token,
      user: toPublicUser(user)
    };
  });

  app.post('/logout', () => {
    return { ok: true };
  });

  app.get('/me', (request) => {
    const context = authenticateJwt(request, config);

    return { user: context.user };
  });

  app.get('/dashboard', (request) => {
    const context = authenticateJwt(request, config);

    return {
      status: 'ok',
      user: context.user
    };
  });
}

export function authenticateJwt(
  request: FastifyRequest,
  config: AppConfig
): JwtAuthContext {
  const authorization = request.headers.authorization;
  if (!authorization?.startsWith('Bearer ')) {
    throw new AppError('JWT required', { statusCode: 401, code: 'JWT_REQUIRED' });
  }

  const token = authorization.slice('Bearer '.length).trim();
  if (!token) {
    throw new AppError('JWT required', { statusCode: 401, code: 'JWT_REQUIRED' });
  }

  const payload = verifyJwt(token, config.auth.sessionSecret);

  return {
    user: {
      sub: payload.sub,
      organizationId: payload.organizationId,
      email: payload.email,
      role: payload.role
    }
  };
}

function invalidCredentials(): AppError {
  return new AppError('Invalid email or password', {
    statusCode: 401,
    code: 'INVALID_CREDENTIALS'
  });
}

function toJwtPayload(user: UserRecord) {
  return {
    sub: user.id,
    organizationId: user.organization_id,
    email: user.email,
    role: user.role
  };
}

function toPublicUser(user: UserRecord) {
  return {
    id: user.id,
    organizationId: user.organization_id,
    email: user.email,
    firstName: user.first_name,
    lastName: user.last_name,
    role: user.role,
    status: user.status
  };
}
