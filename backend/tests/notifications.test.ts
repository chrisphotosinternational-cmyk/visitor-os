import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import type { AppConfig } from '../src/core/config/env.js';
import { NotificationEngine } from '../src/modules/notifications/notification-engine.js';
import type { NotificationStore } from '../src/modules/notifications/notification-repository.js';
import type {
  NotificationRecord,
  NotificationRecordInput,
  NotificationSettings
} from '../src/modules/notifications/notification-types.js';
import type {
  NotificationProvider,
  ProviderSendResult
} from '../src/modules/notifications/notification-provider.js';
import {
  getNotificationTemplate,
  renderNotificationTemplate
} from '../src/modules/notifications/notification-template.js';

describe('Notification Engine', () => {
  it('sends email through the mock provider when no API key is configured', async () => {
    const store = new FakeNotificationStore();
    const engine = new NotificationEngine(store, baseAppConfig());
    const result = await engine.notify({
      type: 'hot_prospect',
      organizationId: testOrganizationId,
      variables: { firstName: 'Chris', score: 86 },
      channels: ['email']
    });

    assert.equal(result.records.length, 1);
    assert.equal(result.records[0]?.provider, 'mock');
    assert.equal(result.records[0]?.status, 'sent');
  });

  it('sends webhooks through the webhook abstraction', async () => {
    const store = new FakeNotificationStore({
      webhookUrl: 'https://example.com/webhook'
    });
    const webhook = new CountingProvider('webhook', true);
    const engine = new NotificationEngine(store, baseAppConfig(), { webhook });
    const result = await engine.notify({
      type: 'export_completed',
      organizationId: testOrganizationId,
      channels: ['webhook']
    });

    assert.equal(webhook.calls, 1);
    assert.equal(result.records[0]?.provider, 'webhook');
    assert.equal(result.records[0]?.status, 'sent');
  });

  it('renders supported template variables', () => {
    const template = renderNotificationTemplate(getNotificationTemplate('hot_prospect'), {
      firstName: 'Ada',
      lastName: 'Lovelace',
      site: 'Demo',
      score: 92
    });

    assert.match(template.content, /Ada Lovelace/);
    assert.match(template.content, /92/);
  });

  it('records CRM, AI, export, follow-up and hot prospect notification types', async () => {
    const store = new FakeNotificationStore();
    const engine = new NotificationEngine(store, baseAppConfig());
    const types = [
      'hot_prospect',
      'ai_provider_unavailable',
      'export_completed',
      'follow_up_today',
      'follow_up_overdue',
      'potential_booking'
    ] as const;

    for (const type of types) {
      await engine.notify({
        type,
        organizationId: testOrganizationId,
        channels: ['internal']
      });
    }

    assert.deepEqual(
      store.records.map((record) => record.type),
      [...types]
    );
  });

  it('retries provider errors and records the failure', async () => {
    const store = new FakeNotificationStore({ retryAttempts: 2 });
    const failingEmail = new CountingProvider('mock', false);
    const engine = new NotificationEngine(store, baseAppConfig(), { email: failingEmail });
    const result = await engine.notify({
      type: 'new_conversation',
      organizationId: testOrganizationId,
      channels: ['email']
    });

    assert.equal(failingEmail.calls, 3);
    assert.equal(result.records[0]?.status, 'failed');
    assert.equal(result.records[0]?.attempt_count, 3);
  });
});

const testOrganizationId = '00000000-0000-4000-8000-000000000001';

class CountingProvider implements NotificationProvider {
  calls = 0;

  constructor(
    readonly providerName: 'mock' | 'webhook',
    private readonly succeeds: boolean
  ) {}

  async send(): Promise<ProviderSendResult> {
    this.calls += 1;

    if (this.succeeds) {
      return {
        ok: true,
        provider: this.providerName,
        attemptCount: 1,
        durationMs: 3
      };
    }

    return {
      ok: false,
      provider: this.providerName,
      attemptCount: 1,
      durationMs: 3,
      errorMessage: 'Provider failed'
    };
  }
}

class FakeNotificationStore implements NotificationStore {
  records: NotificationRecord[] = [];
  private settings: NotificationSettings;

  constructor(settings?: Partial<NotificationSettings>) {
    this.settings = {
      organizationId: testOrganizationId,
      adminEmails: ['admin@example.com'],
      notificationsEnabled: true,
      frequency: 'instant',
      language: 'fr',
      preferredProvider: 'mock',
      webhookUrl: null,
      webhookHeaders: {},
      webhookSecret: null,
      retryAttempts: 0,
      timeoutMs: 100,
      ...settings
    };
  }

  async getSettings(organizationId: string): Promise<NotificationSettings> {
    return { ...this.settings, organizationId };
  }

  async saveSettings(input: NotificationSettings): Promise<NotificationSettings> {
    this.settings = input;

    return input;
  }

  async record(input: NotificationRecordInput): Promise<NotificationRecord> {
    const record: NotificationRecord = {
      id: `${this.records.length + 1}`,
      organization_id: input.organizationId,
      site_id: input.siteId ?? null,
      type: input.type,
      title: input.title,
      subject: input.subject,
      content_preview: input.contentPreview ?? null,
      recipient: input.recipient ?? null,
      provider: input.provider,
      status: input.status,
      error_message: input.errorMessage ?? null,
      attempt_count: input.attemptCount,
      sent_at: input.sentAt ?? null,
      created_at: new Date()
    };
    this.records.push(record);

    return record;
  }

  async list(): Promise<NotificationRecord[]> {
    return this.records;
  }
}

function baseAppConfig(): AppConfig {
  return {
    app: { name: 'VISITOR-OS', environment: 'test' },
    server: { host: '127.0.0.1', port: 3000, shutdownTimeoutMs: 1000 },
    logger: { level: 'silent' },
    database: {
      url: 'postgresql://user:password@localhost:5432/visitor_os',
      ssl: false,
      connectionTimeoutMs: 1000
    },
    security: { allowedOrigins: [], rateLimitWindowMs: 60_000, rateLimitMaxRequests: 120 },
    ai: {},
    notifications: {
      fromEmail: 'notifications@example.com',
      retryAttempts: 2,
      timeoutMs: 100
    },
    businessConfig: { directory: '../configs' },
    auth: {
      sessionSecret: 'dev-only-session-secret-change-before-production',
      sessionTtlMs: 1,
      sessionRenewalMs: 1,
      jwtTtlSeconds: 3_600
    }
  };
}
