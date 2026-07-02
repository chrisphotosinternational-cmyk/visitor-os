import { createHmac, timingSafeEqual } from 'node:crypto';
import { AppError } from '../../core/errors/app-error.js';
import type { UserRole } from '../users/user-model.js';

export type JwtUserPayload = {
  sub: string;
  organizationId: string;
  email: string;
  role: UserRole;
};

export type JwtPayload = JwtUserPayload & {
  iat: number;
  exp: number;
};

export type JwtAuthContext = {
  user: JwtUserPayload;
};

export function signJwt(
  payload: JwtUserPayload,
  secret: string,
  expiresInSeconds: number
): string {
  const now = Math.floor(Date.now() / 1000);
  const jwtPayload: JwtPayload = {
    ...payload,
    iat: now,
    exp: now + expiresInSeconds
  };
  const encodedHeader = encodeJson({ alg: 'HS256', typ: 'JWT' });
  const encodedPayload = encodeJson(jwtPayload);
  const signature = sign(`${encodedHeader}.${encodedPayload}`, secret);

  return `${encodedHeader}.${encodedPayload}.${signature}`;
}

export function verifyJwt(token: string, secret: string): JwtPayload {
  const [header, payload, signature] = token.split('.');
  if (!header || !payload || !signature) {
    throw invalidToken();
  }

  const expected = sign(`${header}.${payload}`, secret);
  if (!safeEqual(signature, expected)) {
    throw invalidToken();
  }

  const decoded = decodePayload(payload);
  const now = Math.floor(Date.now() / 1000);
  if (decoded.exp <= now) {
    throw new AppError('Token expired', { statusCode: 401, code: 'TOKEN_EXPIRED' });
  }

  return decoded;
}

function encodeJson(value: unknown): string {
  return Buffer.from(JSON.stringify(value)).toString('base64url');
}

function sign(value: string, secret: string): string {
  return createHmac('sha256', secret).update(value).digest('base64url');
}

function decodePayload(value: string): JwtPayload {
  try {
    const decoded = JSON.parse(
      Buffer.from(value, 'base64url').toString('utf8')
    ) as Partial<JwtPayload>;
    if (
      !decoded.sub ||
      !decoded.organizationId ||
      !decoded.email ||
      !decoded.role ||
      typeof decoded.iat !== 'number' ||
      typeof decoded.exp !== 'number'
    ) {
      throw invalidToken();
    }

    return decoded as JwtPayload;
  } catch (error) {
    if (error instanceof AppError) throw error;
    throw invalidToken();
  }
}

function safeEqual(left: string, right: string): boolean {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);
  if (leftBuffer.length !== rightBuffer.length) return false;

  return timingSafeEqual(leftBuffer, rightBuffer);
}

function invalidToken(): AppError {
  return new AppError('Invalid token', { statusCode: 401, code: 'INVALID_TOKEN' });
}
