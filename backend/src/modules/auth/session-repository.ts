import { createHash, randomUUID } from 'node:crypto';
import type { Database } from '../../database/client.js';

export type SessionRecord = {
  id: string;
  user_id: string;
  organization_id: string;
  token_hash: string;
  expires_at: Date;
  created_at: Date;
  renewed_at: Date;
  revoked_at: Date | null;
};

export class SessionRepository {
  constructor(private readonly database: Database) {}

  async create(input: {
    userId: string;
    organizationId: string;
    token: string;
    expiresAt: Date;
  }): Promise<SessionRecord> {
    const result = await this.database.query<SessionRecord>(
      `
      insert into admin_sessions (id, user_id, organization_id, token_hash, expires_at)
      values ($1, $2, $3, $4, $5)
      returning *
      `,
      [
        randomUUID(),
        input.userId,
        input.organizationId,
        hashSessionToken(input.token),
        input.expiresAt
      ]
    );

    return requireRow(result.rows[0], 'Session was not created');
  }

  async findValid(token: string): Promise<SessionRecord | null> {
    const result = await this.database.query<SessionRecord>(
      `
      select *
      from admin_sessions
      where token_hash = $1
        and revoked_at is null
        and expires_at > now()
      limit 1
      `,
      [hashSessionToken(token)]
    );

    return result.rows[0] ?? null;
  }

  async renew(id: string, expiresAt: Date): Promise<void> {
    await this.database.query(
      `update admin_sessions set expires_at = $1, renewed_at = now() where id = $2 and revoked_at is null`,
      [expiresAt, id]
    );
  }

  async revoke(token: string): Promise<void> {
    await this.database.query(
      `update admin_sessions set revoked_at = now() where token_hash = $1 and revoked_at is null`,
      [hashSessionToken(token)]
    );
  }
}

export function hashSessionToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

function requireRow<T>(row: T | undefined, message: string): T {
  if (!row) throw new Error(message);

  return row;
}
