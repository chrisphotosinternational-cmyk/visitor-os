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

export class UserRepository {
  constructor(private readonly database: Database) {}

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
}

function requireRow<T>(row: T | undefined, message: string): T {
  if (!row) throw new Error(message);

  return row;
}
