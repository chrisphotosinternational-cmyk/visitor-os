import type { NotificationProviderName } from './notification-types.js';

export type ProviderSendInput = {
  to?: string;
  subject: string;
  title: string;
  content: string;
  webhookUrl?: string;
  webhookHeaders?: Record<string, string>;
  webhookSecret?: string;
  timeoutMs: number;
};

export type ProviderSendResult = {
  ok: boolean;
  provider: NotificationProviderName;
  attemptCount: number;
  durationMs: number;
  errorMessage?: string;
};

export interface NotificationProvider {
  readonly providerName: NotificationProviderName;
  send(input: ProviderSendInput): Promise<ProviderSendResult>;
}

export class InternalProvider implements NotificationProvider {
  readonly providerName = 'internal';

  send(): Promise<ProviderSendResult> {
    return Promise.resolve({
      ok: true,
      provider: this.providerName,
      attemptCount: 1,
      durationMs: 0
    });
  }
}

export class MockEmailProvider implements NotificationProvider {
  readonly providerName = 'mock';

  send(): Promise<ProviderSendResult> {
    return Promise.resolve({
      ok: true,
      provider: this.providerName,
      attemptCount: 1,
      durationMs: 0
    });
  }
}

export class ResendEmailProvider implements NotificationProvider {
  readonly providerName = 'resend';

  constructor(
    private readonly apiKey: string,
    private readonly fromEmail: string,
    private readonly fetcher: typeof fetch = fetch
  ) {}

  async send(input: ProviderSendInput): Promise<ProviderSendResult> {
    const start = Date.now();

    if (!input.to) {
      return {
        ok: false,
        provider: this.providerName,
        attemptCount: 1,
        durationMs: Date.now() - start,
        errorMessage: 'Missing email recipient'
      };
    }

    try {
      const response = await this.fetcher('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          from: this.fromEmail,
          to: input.to,
          subject: input.subject,
          text: `${input.title}\n\n${input.content}`
        }),
        signal: AbortSignal.timeout(input.timeoutMs)
      });

      if (!response.ok) {
        return {
          ok: false,
          provider: this.providerName,
          attemptCount: 1,
          durationMs: Date.now() - start,
          errorMessage: `Resend returned ${response.status}`
        };
      }

      return {
        ok: true,
        provider: this.providerName,
        attemptCount: 1,
        durationMs: Date.now() - start
      };
    } catch (error) {
      return {
        ok: false,
        provider: this.providerName,
        attemptCount: 1,
        durationMs: Date.now() - start,
        errorMessage: error instanceof Error ? error.message : 'Resend request failed'
      };
    }
  }
}

export class WebhookProvider implements NotificationProvider {
  readonly providerName = 'webhook';

  constructor(private readonly fetcher: typeof fetch = fetch) {}

  async send(input: ProviderSendInput): Promise<ProviderSendResult> {
    const start = Date.now();

    if (!input.webhookUrl) {
      return {
        ok: true,
        provider: this.providerName,
        attemptCount: 1,
        durationMs: Date.now() - start
      };
    }

    try {
      const headers = {
        'Content-Type': 'application/json',
        ...(input.webhookHeaders ?? {}),
        ...(input.webhookSecret ? { 'X-Visitor-OS-Secret': input.webhookSecret } : {})
      };
      const response = await this.fetcher(input.webhookUrl, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          subject: input.subject,
          title: input.title,
          content: input.content
        }),
        signal: AbortSignal.timeout(input.timeoutMs)
      });

      if (!response.ok) {
        return {
          ok: false,
          provider: this.providerName,
          attemptCount: 1,
          durationMs: Date.now() - start,
          errorMessage: `Webhook returned ${response.status}`
        };
      }

      return {
        ok: true,
        provider: this.providerName,
        attemptCount: 1,
        durationMs: Date.now() - start
      };
    } catch (error) {
      return {
        ok: false,
        provider: this.providerName,
        attemptCount: 1,
        durationMs: Date.now() - start,
        errorMessage: error instanceof Error ? error.message : 'Webhook request failed'
      };
    }
  }
}
