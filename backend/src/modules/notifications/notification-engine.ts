import type { AppConfig } from '../../core/config/env.js';
import { getNotificationTemplate, renderNotificationTemplate } from './notification-template.js';
import {
  InternalProvider,
  MockEmailProvider,
  ResendEmailProvider,
  WebhookProvider,
  type NotificationProvider,
  type ProviderSendInput
} from './notification-provider.js';
import { SynchronousNotificationQueue } from './notification-queue.js';
import type {
  NotificationProviderName,
  NotificationRecord,
  NotificationRequest,
  NotificationSettings
} from './notification-types.js';
import type { NotificationStore } from './notification-repository.js';

export type NotificationEngineResult = {
  records: NotificationRecord[];
  averageDurationMs: number;
};

export class NotificationEngine {
  private readonly internalProvider: NotificationProvider;
  private readonly emailProvider: NotificationProvider;
  private readonly webhookProvider: NotificationProvider;

  constructor(
    private readonly store: NotificationStore,
    private readonly config: AppConfig,
    providers?: {
      email?: NotificationProvider;
      webhook?: NotificationProvider;
      internal?: NotificationProvider;
    }
  ) {
    this.internalProvider = providers?.internal ?? new InternalProvider();
    this.emailProvider =
      providers?.email ??
      (config.notifications.resendApiKey
        ? new ResendEmailProvider(config.notifications.resendApiKey, config.notifications.fromEmail)
        : new MockEmailProvider());
    this.webhookProvider = providers?.webhook ?? new WebhookProvider();
  }

  async notify(input: NotificationRequest): Promise<NotificationEngineResult> {
    const settings = await this.store.getSettings(input.organizationId);
    const template = renderNotificationTemplate(
      getNotificationTemplate(input.type),
      input.variables
    );

    if (!settings.notificationsEnabled || settings.frequency === 'disabled') {
      const skipped = await this.store.record({
        organizationId: input.organizationId,
        ...(input.siteId ? { siteId: input.siteId } : {}),
        type: input.type,
        title: template.title,
        subject: template.subject,
        contentPreview: preview(template.content),
        provider: 'internal',
        status: 'skipped',
        attemptCount: 0,
        errorMessage: 'Notifications disabled',
        ...(input.recipient ? { recipient: input.recipient } : {})
      });

      return { records: [skipped], averageDurationMs: 0 };
    }

    const channels = input.channels ?? ['internal', 'email', 'webhook'];
    const records: NotificationRecord[] = [];
    const durations: number[] = [];

    if (channels.includes('internal')) {
      const result = await this.sendWithQueue(this.internalProvider, settings, {
        subject: template.subject,
        title: template.title,
        content: template.content,
        timeoutMs: settings.timeoutMs
      });
      durations.push(result.durationMs);
      records.push(
        await this.recordResult(input, template, 'internal', null, result.ok, result.attemptCount)
      );
    }

    if (channels.includes('email')) {
      const recipients = input.recipient ? [input.recipient] : settings.adminEmails;
      for (const recipient of recipients) {
        const result = await this.sendWithQueue(this.emailProvider, settings, {
          to: recipient,
          subject: template.subject,
          title: template.title,
          content: template.content,
          timeoutMs: settings.timeoutMs
        });
        durations.push(result.durationMs);
        records.push(
          await this.recordResult(
            input,
            template,
            result.provider as NotificationProviderName,
            recipient,
            result.ok,
            result.attemptCount,
            result.errorMessage
          )
        );
      }
    }

    if (channels.includes('webhook') && settings.webhookUrl) {
      const result = await this.sendWithQueue(this.webhookProvider, settings, {
        subject: template.subject,
        title: template.title,
        content: template.content,
        webhookUrl: settings.webhookUrl,
        webhookHeaders: settings.webhookHeaders,
        ...(settings.webhookSecret ? { webhookSecret: settings.webhookSecret } : {}),
        timeoutMs: settings.timeoutMs
      });
      durations.push(result.durationMs);
      records.push(
        await this.recordResult(
          input,
          template,
          'webhook',
          settings.webhookUrl,
          result.ok,
          result.attemptCount,
          result.errorMessage
        )
      );
    }

    return {
      records,
      averageDurationMs:
        durations.length === 0
          ? 0
          : Math.round(durations.reduce((sum, duration) => sum + duration, 0) / durations.length)
    };
  }

  private async sendWithQueue(
    provider: NotificationProvider,
    settings: NotificationSettings,
    input: ProviderSendInput
  ) {
    const queue = new SynchronousNotificationQueue(settings.retryAttempts);

    return queue.enqueue(() => provider.send(input));
  }

  private async recordResult(
    input: NotificationRequest,
    template: { title: string; subject: string; content: string },
    provider: NotificationProviderName,
    recipient: string | null,
    ok: boolean,
    attemptCount: number,
    errorMessage?: string
  ): Promise<NotificationRecord> {
    return this.store.record({
      organizationId: input.organizationId,
      ...(input.siteId ? { siteId: input.siteId } : {}),
      type: input.type,
      title: template.title,
      subject: template.subject,
      contentPreview: preview(template.content),
      ...(recipient ? { recipient } : {}),
      provider,
      status: ok ? 'sent' : 'failed',
      attemptCount,
      ...(ok ? { sentAt: new Date() } : {}),
      ...(errorMessage ? { errorMessage } : {})
    });
  }
}

function preview(content: string): string {
  return content.length <= 240 ? content : `${content.slice(0, 237)}...`;
}
