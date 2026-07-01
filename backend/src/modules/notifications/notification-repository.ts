import { randomUUID } from 'node:crypto';
import type { Database } from '../../database/client.js';
import type {
  NotificationRecord,
  NotificationRecordInput,
  NotificationSettings
} from './notification-types.js';

export type NotificationListFilters = {
  organizationId?: string;
  type?: string;
  status?: string;
  provider?: string;
};

export interface NotificationStore {
  getSettings(organizationId: string): Promise<NotificationSettings>;
  saveSettings(input: NotificationSettings): Promise<NotificationSettings>;
  record(input: NotificationRecordInput): Promise<NotificationRecord>;
  list(filters: NotificationListFilters): Promise<NotificationRecord[]>;
}

export class NotificationRepository implements NotificationStore {
  constructor(
    private readonly database: Database,
    private readonly defaults: {
      retryAttempts: number;
      timeoutMs: number;
    }
  ) {}

  async getSettings(organizationId: string): Promise<NotificationSettings> {
    const result = await this.database.query<{
      organization_id: string;
      admin_emails: string[];
      notifications_enabled: boolean;
      frequency: 'instant' | 'daily' | 'disabled';
      language: string;
      preferred_provider: 'mock' | 'resend';
      webhook_url: string | null;
      webhook_headers: Record<string, string> | null;
      webhook_secret: string | null;
      retry_attempts: number;
      timeout_ms: number;
    }>(
      `
      select *
      from notification_settings
      where organization_id = $1
      `,
      [organizationId]
    );

    const row = result.rows[0];

    if (!row) {
      return {
        organizationId,
        adminEmails: [],
        notificationsEnabled: true,
        frequency: 'instant',
        language: 'fr',
        preferredProvider: 'mock',
        webhookUrl: null,
        webhookHeaders: {},
        webhookSecret: null,
        retryAttempts: this.defaults.retryAttempts,
        timeoutMs: this.defaults.timeoutMs
      };
    }

    return {
      organizationId: row.organization_id,
      adminEmails: row.admin_emails,
      notificationsEnabled: row.notifications_enabled,
      frequency: row.frequency,
      language: row.language,
      preferredProvider: row.preferred_provider,
      webhookUrl: row.webhook_url,
      webhookHeaders: row.webhook_headers ?? {},
      webhookSecret: row.webhook_secret,
      retryAttempts: row.retry_attempts,
      timeoutMs: row.timeout_ms
    };
  }

  async saveSettings(input: NotificationSettings): Promise<NotificationSettings> {
    const result = await this.database.query<{
      organization_id: string;
      admin_emails: string[];
      notifications_enabled: boolean;
      frequency: 'instant' | 'daily' | 'disabled';
      language: string;
      preferred_provider: 'mock' | 'resend';
      webhook_url: string | null;
      webhook_headers: Record<string, string> | null;
      webhook_secret: string | null;
      retry_attempts: number;
      timeout_ms: number;
    }>(
      `
      insert into notification_settings (
        organization_id,
        admin_emails,
        notifications_enabled,
        frequency,
        language,
        preferred_provider,
        webhook_url,
        webhook_headers,
        webhook_secret,
        retry_attempts,
        timeout_ms,
        updated_at
      )
      values ($1, $2, $3, $4, $5, $6, $7, $8::jsonb, $9, $10, $11, now())
      on conflict (organization_id)
      do update set
        admin_emails = excluded.admin_emails,
        notifications_enabled = excluded.notifications_enabled,
        frequency = excluded.frequency,
        language = excluded.language,
        preferred_provider = excluded.preferred_provider,
        webhook_url = excluded.webhook_url,
        webhook_headers = excluded.webhook_headers,
        webhook_secret = excluded.webhook_secret,
        retry_attempts = excluded.retry_attempts,
        timeout_ms = excluded.timeout_ms,
        updated_at = now()
      returning *
      `,
      [
        input.organizationId,
        input.adminEmails,
        input.notificationsEnabled,
        input.frequency,
        input.language,
        input.preferredProvider,
        input.webhookUrl,
        JSON.stringify(input.webhookHeaders),
        input.webhookSecret,
        input.retryAttempts,
        input.timeoutMs
      ]
    );
    const row = result.rows[0];

    if (!row) {
      throw new Error('Notification settings were not saved');
    }

    return {
      organizationId: row.organization_id,
      adminEmails: row.admin_emails,
      notificationsEnabled: row.notifications_enabled,
      frequency: row.frequency,
      language: row.language,
      preferredProvider: row.preferred_provider,
      webhookUrl: row.webhook_url,
      webhookHeaders: row.webhook_headers ?? {},
      webhookSecret: row.webhook_secret,
      retryAttempts: row.retry_attempts,
      timeoutMs: row.timeout_ms
    };
  }

  async record(input: NotificationRecordInput): Promise<NotificationRecord> {
    const result = await this.database.query<NotificationRecord>(
      `
      insert into notification_events (
        id,
        organization_id,
        site_id,
        type,
        title,
        subject,
        content_preview,
        recipient,
        provider,
        status,
        error_message,
        attempt_count,
        sent_at
      )
      values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
      returning *
      `,
      [
        randomUUID(),
        input.organizationId,
        input.siteId ?? null,
        input.type,
        input.title,
        input.subject,
        input.contentPreview ?? null,
        input.recipient ?? null,
        input.provider,
        input.status,
        input.errorMessage ?? null,
        input.attemptCount,
        input.sentAt ?? null
      ]
    );
    const row = result.rows[0];

    if (!row) {
      throw new Error('Notification event was not recorded');
    }

    return row;
  }

  async list(filters: NotificationListFilters): Promise<NotificationRecord[]> {
    const result = await this.database.query<NotificationRecord>(
      `
      select *
      from notification_events
      where
        ($1::uuid is null or organization_id = $1)
        and ($2::text is null or type = $2)
        and ($3::text is null or status = $3)
        and ($4::text is null or provider = $4)
      order by created_at desc
      limit 200
      `,
      [
        filters.organizationId ?? null,
        filters.type ?? null,
        filters.status ?? null,
        filters.provider ?? null
      ]
    );

    return result.rows;
  }
}
