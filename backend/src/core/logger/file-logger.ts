import { mkdir, rename, stat, appendFile } from 'node:fs/promises';
import { dirname } from 'node:path';

export type FileLogName = 'application' | 'error' | 'audit';

export type FileLogConfig = {
  enabled: boolean;
  directory: string;
  maxBytes: number;
};

const logFiles: Record<FileLogName, string> = {
  application: 'application.log',
  error: 'error.log',
  audit: 'audit.log'
};

export async function writeFileLog(
  config: FileLogConfig,
  name: FileLogName,
  payload: Record<string, unknown>
): Promise<void> {
  if (!config.enabled) return;

  const file = `${config.directory}/${logFiles[name]}`;
  await mkdir(dirname(file), { recursive: true });
  await rotateIfNeeded(file, config.maxBytes);
  await appendFile(file, `${JSON.stringify({ time: new Date().toISOString(), ...payload })}\n`);
}

async function rotateIfNeeded(file: string, maxBytes: number): Promise<void> {
  if (maxBytes <= 0) return;

  try {
    const current = await stat(file);
    if (current.size < maxBytes) return;
    await rename(file, `${file}.${Date.now()}`);
  } catch {
    // No file yet, or rotation failed because another process rotated it first.
  }
}
