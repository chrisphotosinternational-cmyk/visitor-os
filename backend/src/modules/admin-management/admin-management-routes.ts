import type { FastifyInstance, FastifyRequest } from 'fastify';
import { z } from 'zod';
import { AppError } from '../../core/errors/app-error.js';
import type { AppConfig } from '../../core/config/env.js';
import type { Database } from '../../database/client.js';
import {
  OrganizationRepository,
  organizationStatuses
} from '../organizations/organization-repository.js';
import { UserRepository, type UserRecord } from '../users/user-repository.js';
import { userRoles, userStatuses, type UserRole } from '../users/user-model.js';
import { hashPassword } from '../auth/password.js';
import { authenticateJwt } from '../auth/jwt-auth-routes.js';
import { hasPermission } from '../auth/rbac.js';

const organizationPayloadSchema = z.object({
  name: z.string().min(1),
  slug: z.string().min(1),
  description: z.string().optional(),
  email: z.string().email().optional(),
  phone: z.string().optional(),
  country: z.string().min(2).default('FR'),
  language: z.string().min(2).default('fr'),
  timezone: z.string().min(1).default('Europe/Paris'),
  currency: z.string().min(3).default('EUR'),
  status: z.enum(organizationStatuses).default('active'),
  plan: z.string().optional()
});

const userPayloadSchema = z.object({
  organizationId: z.string().uuid(),
  firstName: z.string().min(1),
  lastName: z.string().min(1),
  email: z.string().email(),
  password: z.string().min(12).optional(),
  role: z.enum(userRoles),
  status: z.enum(userStatuses).default('active')
});

const listQuerySchema = z.object({
  search: z.string().optional()
});

export function registerAdminManagementRoutes(
  app: FastifyInstance,
  database: Database,
  config: AppConfig
): void {
  const organizations = new OrganizationRepository(database);
  const users = new UserRepository(database);

  app.get('/admin-api/dashboard', async (request) => {
    const context = await resolveContext(request, config, users);
    requirePermission(context.user, 'organizations:read');
    const organizationId = context.user.role === 'SuperAdmin' ? undefined : context.user.organization_id;

    return {
      organizationsCount:
        context.user.role === 'SuperAdmin'
          ? await organizations.count()
          : context.user.organization_id
            ? 1
            : 0,
      usersCount: await users.count(organizationId),
      role: context.user.role,
      organizationId: context.user.organization_id
    };
  });

  app.get('/admin-api/organizations', async (request) => {
    const context = await resolveContext(request, config, users);
    requirePermission(context.user, 'organizations:read');
    const query = listQuerySchema.parse(request.query);

    return {
      organizations:
        context.user.role === 'SuperAdmin'
          ? await organizations.list(query.search)
          : optional(await organizations.find(context.user.organization_id)),
      statuses: organizationStatuses
    };
  });

  app.post('/admin-api/organizations', async (request) => {
    const context = await resolveContext(request, config, users);
    requirePermission(context.user, 'organizations:write');
    const body = organizationPayloadSchema.parse(request.body);
    const organization = await organizations.create(toOrganizationInput(body));

    return { organization, statuses: organizationStatuses };
  });

  app.put('/admin-api/organizations/:organizationId', async (request) => {
    const context = await resolveContext(request, config, users);
    requirePermission(context.user, 'organizations:write');
    const params = z.object({ organizationId: z.string().uuid() }).parse(request.params);
    const body = organizationPayloadSchema.parse(request.body);
    requireOrganizationAccess(context.user, params.organizationId);
    const organization = await organizations.update(params.organizationId, toOrganizationInput(body));

    if (!organization) throw notFound('Organization not found', 'ORGANIZATION_NOT_FOUND');

    return { organization };
  });

  app.patch('/admin-api/organizations/:organizationId/status', async (request) => {
    const context = await resolveContext(request, config, users);
    requirePermission(context.user, 'organizations:write');
    const params = z.object({ organizationId: z.string().uuid() }).parse(request.params);
    const body = z.object({ status: z.enum(organizationStatuses) }).parse(request.body);
    requireOrganizationAccess(context.user, params.organizationId);
    const organization = await organizations.updateStatus(params.organizationId, body.status);

    if (!organization) throw notFound('Organization not found', 'ORGANIZATION_NOT_FOUND');

    return { organization };
  });

  app.delete('/admin-api/organizations/:organizationId', async (request) => {
    const context = await resolveContext(request, config, users);
    requirePermission(context.user, 'organizations:write');
    const params = z.object({ organizationId: z.string().uuid() }).parse(request.params);
    requireOrganizationAccess(context.user, params.organizationId);

    return { deleted: await organizations.delete(params.organizationId) };
  });

  app.get('/admin-api/users', async (request) => {
    const context = await resolveContext(request, config, users);
    requirePermission(context.user, 'users:read');
    const query = listQuerySchema.parse(request.query);
    const organizationId = context.user.role === 'SuperAdmin' ? undefined : context.user.organization_id;

    return {
      users: (await users.list(toUserListInput(organizationId, query.search))).map(toPublicUser),
      roles: userRoles,
      statuses: userStatuses
    };
  });

  app.post('/admin-api/users', async (request) => {
    const context = await resolveContext(request, config, users);
    requirePermission(context.user, 'users:write');
    const body = userPayloadSchema.required({ password: true }).parse(request.body);
    requireOrganizationAccess(context.user, body.organizationId);
    const user = await users.create({
      organizationId: body.organizationId,
      firstName: body.firstName,
      lastName: body.lastName,
      email: body.email,
      passwordHash: await hashPassword(body.password),
      role: resolveAssignableRole(context.user, body.role),
      status: body.status
    });

    return { user: toPublicUser(user), roles: userRoles, statuses: userStatuses };
  });

  app.put('/admin-api/users/:userId', async (request) => {
    const context = await resolveContext(request, config, users);
    requirePermission(context.user, 'users:write');
    const params = z.object({ userId: z.string().uuid() }).parse(request.params);
    const body = userPayloadSchema.parse(request.body);
    requireOrganizationAccess(context.user, body.organizationId);
    const user = await users.update(params.userId, {
      organizationId: body.organizationId,
      firstName: body.firstName,
      lastName: body.lastName,
      email: body.email,
      role: resolveAssignableRole(context.user, body.role),
      status: body.status,
      ...(body.password ? { passwordHash: await hashPassword(body.password) } : {})
    });

    if (!user) throw notFound('User not found', 'USER_NOT_FOUND');

    return { user: toPublicUser(user) };
  });

  app.patch('/admin-api/users/:userId/status', async (request) => {
    const context = await resolveContext(request, config, users);
    requirePermission(context.user, 'users:write');
    const params = z.object({ userId: z.string().uuid() }).parse(request.params);
    const body = z.object({ status: z.enum(userStatuses) }).parse(request.body);
    const target = await users.findById(params.userId);
    if (!target) throw notFound('User not found', 'USER_NOT_FOUND');
    requireOrganizationAccess(context.user, target.organization_id);
    const user = await users.updateStatus(params.userId, body.status);

    return { user: user ? toPublicUser(user) : null };
  });
}

async function resolveContext(
  request: FastifyRequest,
  config: AppConfig,
  users: UserRepository
): Promise<{ user: UserRecord }> {
  const jwt = authenticateJwt(request, config);
  const user = await users.findById(jwt.user.sub);
  if (!user || user.status !== 'active') {
    throw new AppError('Invalid token user', { statusCode: 401, code: 'INVALID_TOKEN_USER' });
  }

  return { user };
}

function requirePermission(user: UserRecord, permission: Parameters<typeof hasPermission>[1]): void {
  if (!hasPermission(user.role, permission)) {
    throw new AppError('Permission denied', { statusCode: 403, code: 'PERMISSION_DENIED' });
  }
}

function requireOrganizationAccess(user: UserRecord, organizationId: string): void {
  if (user.role !== 'SuperAdmin' && user.organization_id !== organizationId) {
    throw new AppError('Organization access denied', {
      statusCode: 403,
      code: 'ORGANIZATION_ACCESS_DENIED'
    });
  }
}

function resolveAssignableRole(user: UserRecord, role: UserRole): UserRole {
  if (role === 'SuperAdmin' && user.role !== 'SuperAdmin') {
    throw new AppError('Only SuperAdmin can assign SuperAdmin role', {
      statusCode: 403,
      code: 'ROLE_ASSIGNMENT_DENIED'
    });
  }

  return role;
}

function toPublicUser(user: UserRecord) {
  return {
    id: user.id,
    organizationId: user.organization_id,
    firstName: user.first_name,
    lastName: user.last_name,
    email: user.email,
    role: user.role,
    status: user.status,
    createdAt: user.created_at,
    updatedAt: user.updated_at
  };
}

function toOrganizationInput(input: z.infer<typeof organizationPayloadSchema>) {
  return {
    name: input.name,
    slug: input.slug,
    country: input.country,
    language: input.language,
    timezone: input.timezone,
    currency: input.currency,
    status: input.status,
    ...(input.description ? { description: input.description } : {}),
    ...(input.email ? { email: input.email } : {}),
    ...(input.phone ? { phone: input.phone } : {}),
    ...(input.plan ? { plan: input.plan } : {})
  };
}

function toUserListInput(organizationId?: string, search?: string): { organizationId?: string; search?: string } {
  return {
    ...(organizationId ? { organizationId } : {}),
    ...(search ? { search } : {})
  };
}

function optional<T>(value: T | null): T[] {
  return value ? [value] : [];
}

function notFound(message: string, code: string): AppError {
  return new AppError(message, { statusCode: 404, code });
}
