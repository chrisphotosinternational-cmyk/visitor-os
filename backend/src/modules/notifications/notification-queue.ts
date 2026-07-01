export type NotificationJobResult = {
  ok: boolean;
  provider?: string;
  attemptCount: number;
  durationMs: number;
  errorMessage?: string;
};

export interface NotificationQueue {
  enqueue(job: () => Promise<NotificationJobResult>): Promise<NotificationJobResult>;
}

export class SynchronousNotificationQueue implements NotificationQueue {
  constructor(private readonly retryAttempts: number) {}

  async enqueue(job: () => Promise<NotificationJobResult>): Promise<NotificationJobResult> {
    let lastResult: NotificationJobResult | null = null;
    const attempts = Math.max(1, this.retryAttempts + 1);

    for (let attempt = 1; attempt <= attempts; attempt += 1) {
      lastResult = await job();

      if (lastResult.ok) {
        return { ...lastResult, attemptCount: attempt };
      }
    }

    return {
      ok: false,
      attemptCount: attempts,
      durationMs: lastResult?.durationMs ?? 0,
      errorMessage: lastResult?.errorMessage ?? 'Notification job failed'
    };
  }
}
