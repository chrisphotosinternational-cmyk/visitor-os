import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import type { FastifyReply, FastifyRequest } from 'fastify';
import { AppError } from '../../core/errors/app-error.js';
import type { AppConfig } from '../../core/config/env.js';
import type { Database } from '../../database/client.js';
import { UserRepository, type UserRecord } from '../users/user-repository.js';
import type { UserRole } from '../users/user-model.js';
import { hasPermission, type Permission } from './rbac.js';
import { SessionRepository, type SessionRecord } from './session-repository.js';
import { verifyPassword } from './password.js';

const SESSION_COOKIE_NAME = 'visitor_os_admin_session';

export type AuthContext = {
  user: {
    id: string;
    organizationId: string;
    email: string;
    firstName: string;
    lastName: string;
    role: UserRole;
    status: string;
  };
  session: SessionRecord;
};

export class AuthService {
  private readonly users: UserRepository;
  private readonly sessions: SessionRepository;

  constructor(
    database: Database,
    private readonly config: AppConfig
  ) {
    this.users = new UserRepository(database);
    this.sessions = new SessionRepository(database);
  }

  async login(input: {
    email: string;
    password: string;
    reply: FastifyReply;
  }): Promise<AuthContext['user']> {
    const user = await this.users.findByEmail(input.email);

    if (!user || user.status !== 'active' || !user.password_hash) {
      throw invalidCredentials();
    }

    const valid = await verifyPassword(input.password, user.password_hash);
    if (!valid) {
      throw invalidCredentials();
    }

    const token = createSessionToken();
    const expiresAt = new Date(Date.now() + this.config.auth.sessionTtlMs);
    const session = await this.sessions.create({
      userId: user.id,
      organizationId: user.organization_id,
      token,
      expiresAt
    });

    this.setSessionCookie(input.reply, token, expiresAt);

    return toAuthUser(user, session);
  }

  async logout(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    const token = this.readSessionToken(request);

    if (token) {
      await this.sessions.revoke(token);
    }

    reply.header('Set-Cookie', this.buildExpiredCookie());
  }

  async authenticate(request: FastifyRequest, reply?: FastifyReply): Promise<AuthContext> {
    const token = this.readSessionToken(request);

    if (!token) {
      throw new AppError('Authentication required', { statusCode: 401, code: 'AUTH_REQUIRED' });
    }

    const session = await this.sessions.findValid(token);
    if (!session) {
      throw new AppError('Invalid session', { statusCode: 401, code: 'INVALID_SESSION' });
    }

    const user = await this.users.findById(session.user_id);
    if (!user || user.status !== 'active') {
      throw new AppError('Invalid session', { statusCode: 401, code: 'INVALID_SESSION' });
    }

    if (reply && shouldRenew(session.renewed_at, this.config.auth.sessionRenewalMs)) {
      const nextToken = createSessionToken();
      const nextExpiresAt = new Date(Date.now() + this.config.auth.sessionTtlMs);
      await this.sessions.revoke(token);
      const nextSession = await this.sessions.create({
        userId: user.id,
        organizationId: user.organization_id,
        token: nextToken,
        expiresAt: nextExpiresAt
      });
      this.setSessionCookie(reply, nextToken, nextExpiresAt);

      return {
        user: toAuthUser(user, nextSession),
        session: nextSession
      };
    }

    return {
      user: toAuthUser(user, session),
      session
    };
  }

  requirePermission(context: AuthContext, permission: Permission): void {
    if (!hasPermission(context.user.role, permission)) {
      throw new AppError('Permission denied', { statusCode: 403, code: 'PERMISSION_DENIED' });
    }
  }

  requireRole(context: AuthContext, roles: readonly UserRole[]): void {
    if (!roles.includes(context.user.role)) {
      throw new AppError('Role denied', { statusCode: 403, code: 'ROLE_DENIED' });
    }
  }

  requireOrganizationAccess(
    context: AuthContext,
    organizationId?: string | null
  ): string | undefined {
    if (context.user.role === 'SuperAdmin') {
      return organizationId ?? undefined;
    }

    if (organizationId && organizationId !== context.user.organizationId) {
      throw new AppError('Organization access denied', {
        statusCode: 403,
        code: 'ORGANIZATION_ACCESS_DENIED'
      });
    }

    return context.user.organizationId;
  }

  private setSessionCookie(reply: FastifyReply, token: string, expiresAt: Date): void {
    reply.header(
      'Set-Cookie',
      this.buildCookie(signToken(token, this.config.auth.sessionSecret), expiresAt)
    );
  }

  private readSessionToken(request: FastifyRequest): string | null {
    const cookieHeader = request.headers.cookie;
    if (!cookieHeader) return null;

    const cookies = Object.fromEntries(
      cookieHeader.split(';').map((cookie) => {
        const [name = '', ...valueParts] = cookie.trim().split('=');

        return [name, decodeURIComponent(valueParts.join('='))];
      })
    );
    const signed = cookies[SESSION_COOKIE_NAME];
    if (!signed) return null;

    return verifySignedToken(signed, this.config.auth.sessionSecret);
  }

  private buildCookie(value: string, expiresAt: Date): string {
    return [
      `${SESSION_COOKIE_NAME}=${encodeURIComponent(value)}`,
      'Path=/',
      'HttpOnly',
      'SameSite=Lax',
      `Expires=${expiresAt.toUTCString()}`,
      this.config.app.environment === 'production' ? 'Secure' : ''
    ]
      .filter(Boolean)
      .join('; ');
  }

  private buildExpiredCookie(): string {
    return [
      `${SESSION_COOKIE_NAME}=`,
      'Path=/',
      'HttpOnly',
      'SameSite=Lax',
      'Expires=Thu, 01 Jan 1970 00:00:00 GMT',
      this.config.app.environment === 'production' ? 'Secure' : ''
    ]
      .filter(Boolean)
      .join('; ');
  }
}

function signToken(token: string, secret = ''): string {
  const signature = createHmac('sha256', secret).update(token).digest('base64url');

  return `${token}.${signature}`;
}

function verifySignedToken(value: string, secret: string): string | null {
  const [token, signature] = value.split('.');
  if (!token || !signature) return null;

  const expected = signToken(token, secret).split('.')[1];
  if (!expected) return null;

  const expectedBuffer = Buffer.from(expected);
  const actualBuffer = Buffer.from(signature);
  if (expectedBuffer.length !== actualBuffer.length) return null;

  return timingSafeEqual(expectedBuffer, actualBuffer) ? token : null;
}

function createSessionToken(): string {
  return randomBytes(32).toString('base64url');
}

function shouldRenew(renewedAt: Date, renewalMs: number): boolean {
  return Date.now() - renewedAt.getTime() > renewalMs;
}

function invalidCredentials(): AppError {
  return new AppError('Invalid email or password', {
    statusCode: 401,
    code: 'INVALID_CREDENTIALS'
  });
}

function toAuthUser(user: UserRecord, session: SessionRecord): AuthContext['user'] {
  void session;

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
