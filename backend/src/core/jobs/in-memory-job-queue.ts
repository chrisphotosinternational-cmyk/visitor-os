import { randomUUID } from 'node:crypto';

export type QueueJobStatus = 'queued' | 'running' | 'completed' | 'failed';

export type QueueJobRecord = {
  id: string;
  name: string;
  status: QueueJobStatus;
  createdAt: Date;
  updatedAt: Date;
  error?: string;
};

export type QueueStats = {
  enabled: boolean;
  queued: number;
  running: number;
  completed: number;
  failed: number;
  total: number;
};

export class InMemoryJobQueue {
  private readonly jobs = new Map<string, QueueJobRecord>();

  enqueue(name: string, handler: () => Promise<void>): QueueJobRecord {
    const job: QueueJobRecord = {
      id: randomUUID(),
      name,
      status: 'queued',
      createdAt: new Date(),
      updatedAt: new Date()
    };
    this.jobs.set(job.id, job);

    queueMicrotask(() => {
      void this.run(job.id, handler);
    });

    return job;
  }

  get(jobId: string): QueueJobRecord | null {
    return this.jobs.get(jobId) ?? null;
  }

  stats(): QueueStats {
    const values = [...this.jobs.values()];

    return {
      enabled: true,
      queued: values.filter((job) => job.status === 'queued').length,
      running: values.filter((job) => job.status === 'running').length,
      completed: values.filter((job) => job.status === 'completed').length,
      failed: values.filter((job) => job.status === 'failed').length,
      total: values.length
    };
  }

  private async run(jobId: string, handler: () => Promise<void>): Promise<void> {
    const job = this.jobs.get(jobId);
    if (!job) return;

    job.status = 'running';
    job.updatedAt = new Date();
    try {
      await handler();
      job.status = 'completed';
    } catch (error) {
      job.status = 'failed';
      job.error = error instanceof Error ? error.message : 'Job failed';
    } finally {
      job.updatedAt = new Date();
    }
  }
}
