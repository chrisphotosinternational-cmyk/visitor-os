import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { z } from 'zod';
import { validateBusinessConfig, type BusinessConfig } from './business-config-schema.js';

export type BusinessConfigSummary = {
  id: string;
  version: string;
  name: string;
  category: string;
};

export type BusinessConfigHistoryItem = {
  configId: string;
  version: string;
  author: string;
  comment: string;
  createdAt: string;
  fileName: string;
};

export type BusinessConfigEngine = {
  loadAll: () => Promise<void>;
  reload: () => Promise<void>;
  list: () => Promise<BusinessConfigSummary[]>;
  getConfig: (id: string) => Promise<BusinessConfig>;
  resolveConfig: (configId?: string | null) => Promise<BusinessConfig>;
  exportConfig: (id: string) => Promise<BusinessConfig>;
  importConfig: (input: {
    config: unknown;
    author?: string;
    comment?: string;
  }) => Promise<BusinessConfig>;
  saveConfig: (input: {
    id: string;
    config: unknown;
    author?: string;
    comment?: string;
  }) => Promise<BusinessConfig>;
  listHistory: (id: string) => Promise<BusinessConfigHistoryItem[]>;
};

const importPayloadSchema = z.object({
  config: z.unknown(),
  author: z.string().trim().min(1).optional(),
  comment: z.string().trim().optional()
});

export const businessConfigImportPayloadSchema = importPayloadSchema;

export function createBusinessConfigEngine(options: {
  configDirectory: string;
}): BusinessConfigEngine {
  const configDirectory = path.resolve(options.configDirectory);
  const historyDirectory = path.join(configDirectory, '.history');
  const cache = new Map<string, BusinessConfig>();

  async function loadAll(): Promise<void> {
    await mkdir(configDirectory, { recursive: true });
    const entries = await readdir(configDirectory, { withFileTypes: true });
    const jsonFiles = entries
      .filter(
        (entry) =>
          entry.isFile() && entry.name.endsWith('.json') && !entry.name.endsWith('.example.json')
      )
      .map((entry) => entry.name)
      .sort();
    const nextCache = new Map<string, BusinessConfig>();

    for (const fileName of jsonFiles) {
      const fileContent = await readFile(path.join(configDirectory, fileName), 'utf8');
      const parsed = validateBusinessConfig(JSON.parse(fileContent));
      nextCache.set(parsed.id, parsed);
    }

    cache.clear();
    for (const [id, config] of nextCache) {
      cache.set(id, config);
    }
  }

  async function ensureLoaded(): Promise<void> {
    if (cache.size === 0) {
      await loadAll();
    }
  }

  async function writeConfig(config: BusinessConfig): Promise<void> {
    await mkdir(configDirectory, { recursive: true });
    await writeFile(configPath(config.id), `${JSON.stringify(config, null, 2)}\n`, 'utf8');
    cache.set(config.id, config);
  }

  function configPath(id: string): string {
    return path.join(configDirectory, `${id}.json`);
  }

  async function createHistoryEntry(input: {
    config: BusinessConfig;
    author?: string;
    comment?: string;
  }): Promise<void> {
    await mkdir(historyDirectory, { recursive: true });
    const createdAt = new Date().toISOString();
    const safeDate = createdAt.replace(/[:.]/g, '-');
    const fileName = `${input.config.id}-${safeDate}.json`;
    const payload = {
      configId: input.config.id,
      version: input.config.version,
      author: input.author ?? 'system',
      comment: input.comment ?? 'Configuration saved',
      createdAt,
      config: input.config
    };

    await writeFile(
      path.join(historyDirectory, fileName),
      `${JSON.stringify(payload, null, 2)}\n`,
      'utf8'
    );
  }

  return {
    loadAll,

    async reload(): Promise<void> {
      await loadAll();
    },

    async list(): Promise<BusinessConfigSummary[]> {
      await ensureLoaded();

      return [...cache.values()]
        .map((config) => ({
          id: config.id,
          version: config.version,
          name: config.identity.name,
          category: config.identity.category
        }))
        .sort((first, second) => first.name.localeCompare(second.name));
    },

    async getConfig(id: string): Promise<BusinessConfig> {
      await ensureLoaded();
      const config = cache.get(id);

      if (!config) {
        throw new Error(`Business configuration not found: ${id}`);
      }

      return config;
    },

    async resolveConfig(configId?: string | null): Promise<BusinessConfig> {
      await ensureLoaded();

      if (configId && cache.has(configId)) {
        return this.getConfig(configId);
      }

      if (cache.has('default')) {
        return this.getConfig('default');
      }

      const firstConfig = cache.values().next().value;
      if (firstConfig) {
        return firstConfig;
      }

      throw new Error('No business configuration available');
    },

    async exportConfig(id: string): Promise<BusinessConfig> {
      return this.getConfig(id);
    },

    async importConfig(input): Promise<BusinessConfig> {
      const payload = importPayloadSchema.parse(input);
      const config = validateBusinessConfig(payload.config);

      await writeConfig(config);
      await createHistoryEntry({
        config,
        ...(payload.author ? { author: payload.author } : {}),
        comment: payload.comment ?? 'Imported from JSON'
      });

      return config;
    },

    async saveConfig(input): Promise<BusinessConfig> {
      const config = validateBusinessConfig(input.config);

      if (config.id !== input.id) {
        throw new Error('Configuration id does not match route id');
      }

      await writeConfig(config);
      await createHistoryEntry({
        config,
        ...(input.author ? { author: input.author } : {}),
        comment: input.comment ?? 'Saved from admin'
      });

      return config;
    },

    async listHistory(id: string): Promise<BusinessConfigHistoryItem[]> {
      await mkdir(historyDirectory, { recursive: true });
      const entries = await readdir(historyDirectory, { withFileTypes: true });
      const items: BusinessConfigHistoryItem[] = [];

      for (const entry of entries) {
        if (!entry.isFile() || !entry.name.startsWith(`${id}-`) || !entry.name.endsWith('.json')) {
          continue;
        }

        const content = await readFile(path.join(historyDirectory, entry.name), 'utf8');
        const parsed = z
          .object({
            configId: z.string(),
            version: z.string(),
            author: z.string(),
            comment: z.string(),
            createdAt: z.string()
          })
          .parse(JSON.parse(content));

        items.push({ ...parsed, fileName: entry.name });
      }

      return items.sort((first, second) => second.createdAt.localeCompare(first.createdAt));
    }
  };
}
