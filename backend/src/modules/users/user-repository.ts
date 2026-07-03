import { randomUUID } from 'node:crypto';
import type { Database } from '../../database/client.js';
import type { UserRole, UserStatus } from './user-model.js';

export type UserRecord = {
  id: string;
  organization_id: string;
  first_name: string;
  last_name: string;
  email: string;
  password_hash: string | null;
  role: UserRole;
  status: UserStatus;
  created_at: Date;
  updated_at: Date;
};

export type CreateUserInput = {
  organizationId: string;
  firstName: string;
  lastName: string;
  email: string;
  passwordHash: string;
  role: UserRole;
  status?: UserStatus;
};

export type UpdateUserInput = {
  organizationId: string;
  firstName: string;
  lastName: string;
  email: string;
  role: UserRole;
  status: UserStatus;
  passwordHash?: string;
};

export class UserRepository {
  constructor(private readonly database: Database) {}

  async list(input: { organizationId?: string; search?: string } = {}): Promise<UserRecord[]> {
    const searchTerm = `%${input.search ?? ''}%`;
    const result = await this.database.query<UserRecord>(
      `
      select * from users
      where ($1::uuid is null or organization_id = $1)
        and ($2 = '%%' or email ilike $2 or first_name ilike $2 or last_name ilike $2)
      order by created_at desc, email asc
      limit 200
      `,
      [input.organizationId ?? null, searchTerm]
    );

    return result.rows;
  }

  async count(organizationId?: string): Promise<number> {
    const result = await this.database.query<{ count: string }>(
      `
      select count(*)::text as count from users
      where ($1::uuid is null or organization_id = $1)
      `,
      [organizationId ?? null]
    );

    return Number(result.rows[0]?.count ?? 0);
  }

  async findByEmail(email: string): Promise<UserRecord | null> {
    const result = await this.database.query<UserRecord>(
      `select * from users where lower(email) = lower($1) limit 1`,
      [email]
    );

    return result.rows[0] ?? null;
  }

  async findById(id: string): Promise<UserRecord | null> {
    const result = await this.database.query<UserRecord>(`select * from users where id = $1`, [id]);

    return result.rows[0] ?? null;
  }

  async create(input: CreateUserInput): Promise<UserRecord> {
    const result = await this.database.query<UserRecord>(
      `
      insert into users (
        id,
        organization_id,
        first_name,
        last_name,
        email,
        password_hash,
        role,
        status
      )
      values ($1, $2, $3, $4, $5, $6, $7, $8)
      returning *
      `,
      [
        randomUUID(),
        input.organizationId,
        input.firstName,
        input.lastName,
        input.email.toLowerCase(),
        input.passwordHash,
        input.role,
        input.status ?? 'active'
      ]
    );

    return requireRow(result.rows[0], 'User was not created');
  }

  async update(id: string, input: UpdateUserInput): Promise<UserRecord | null> {
    const result = await this.database.query<UserRecord>(
      `
      update users
      set
        organization_id = $1,
        first_name = $2,
        last_name = $3,
        email = $4,
        role = $5,
        status = $6,
        password_hash = coalesce($7, password_hash),
        updated_at = now()
      where id = $8
      returning *
      `,
      [
        input.organizationId,
        input.firstName,
        input.lastName,
        input.email.toLowerCase(),
        input.role,
        input.status,
        input.passwordHash ?? null,
        id
      ]
    );

    return result.rows[0] ?? null;
  }

  async updateStatus(id: string, status: UserStatus): Promise<UserRecord | null> {
    const result = await this.database.query<UserRecord>(
      `update users set status = $1, updated_at = now() where id = $2 returning *`,
      [status, id]
    );

    return result.rows[0] ?? null;
  }
}

function requireRow<T>(row: T | undefined, message: string): T {
  if (!row) throw new Error(message);

  return row;
}
