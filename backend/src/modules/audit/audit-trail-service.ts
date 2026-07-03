import { randomUUID } from 'node:crypto';
import type { FastifyRequest } from 'fastify';
import type { Database } from '../../database/client.js';
import { getTraceId } from '../../core/observability/trace-context.js';

export type AuditTrailInput = {
  organizationId?: string | null;
  userId?: string | null;
  action: string;
  resource: string;
  resourceId?: string | null;
  before?: unknown;
  after?: unknown;
  request?: FastifyRequest;
};

export class AuditTrailService {
  constructor(private readonly database: Database) {}

  async record(input: AuditTrailInput): Promise<void> {
    if (!this.database.isConfigured()) return;

    await this.database.query(
      `
      insert into audit_trail (
        id,
        organization_id,
        user_id,
        ip,
        user_agent,
        trace_id,
        action,
        resource,
        resource_id,
        before,
        after
      )
      values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10::jsonb, $11::jsonb)
      `,
      [
        randomUUID(),
        input.organizationId ?? null,
        input.userId ?? null,
        input.request?.ip ?? null,
        input.request?.headers['user-agent'] ?? null,
        input.request ? getTraceId(input.request) : null,
        input.action,
        input.resource,
        input.resourceId ?? null,
        JSON.stringify(input.before ?? null),
        JSON.stringify(input.after ?? null)
      ]
    );
  }

  async safeRecord(input: AuditTrailInput): Promise<void> {
    try {
      await this.record(input);
    } catch {
      // Audit failures must not break product flows.
    }
  }
}

export function actionFromRequest(request: FastifyRequest): {
  action: string;
  resource: string;
  resourceId?: string;
} {
  const method = request.method.toLowerCase();
  const url = request.url.split('?')[0] ?? request.url;
  const parts = url.split('/').filter(Boolean);
  const resource = parts[1] === 'admin-api' ? (parts[2] ?? 'admin') : (parts[1] ?? 'admin');
  const resourceId = parts.find((part) => /^[0-9a-f-]{36}$/i.test(part));

  return {
    action: `${method}_${resource}`,
    resource,
    ...(resourceId ? { resourceId } : {})
  };
}
