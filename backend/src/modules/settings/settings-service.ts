import { randomUUID } from 'node:crypto';
import type { Database } from '../../database/client.js';

export const featureFlagKeys = [
  'ai',
  'enrichment',
  'forecast',
  'advanced_dashboard',
  'exports'
] as const;

export type FeatureFlagKey = (typeof featureFlagKeys)[number];

export type FeatureFlags = Record<FeatureFlagKey, boolean>;

export type FeatureFlagUpdates = Partial<Record<FeatureFlagKey, boolean | undefined>>;

export type RuntimeSettings = {
  scoring: {
    email: number;
    phone: number;
    city: number;
    social: number;
    premiumPlatform: number;
    portfolio: number;
    description: number;
    noContactPenalty: number;
    duplicatePenalty: number;
  };
  pipeline: {
    staleDays: number;
  };
  forecast: {
    averageDealValue: number;
    lowConversionRate: number;
    mediumConversionRate: number;
    highConversionRate: number;
  };
  timeouts: {
    enrichmentMs: number;
    notificationMs: number;
  };
  rateLimits: {
    windowMs: number;
    maxRequests: number;
  };
  batch: {
    size: number;
  };
  cache: {
    ttlMs: number;
  };
};

type UpdateShape<T> = {
  [Key in keyof T]?: T[Key] extends Record<string, unknown>
    ? UpdateShape<T[Key]> | undefined
    : T[Key] | undefined;
};

export type RuntimeSettingsUpdate = UpdateShape<RuntimeSettings>;

export const defaultFeatureFlags: FeatureFlags = {
  ai: true,
  enrichment: true,
  forecast: true,
  advanced_dashboard: true,
  exports: true
};

export const defaultRuntimeSettings: RuntimeSettings = {
  scoring: {
    email: 15,
    phone: 15,
    city: 10,
    social: 10,
    premiumPlatform: 20,
    portfolio: 10,
    description: 10,
    noContactPenalty: -25,
    duplicatePenalty: -20
  },
  pipeline: {
    staleDays: 14
  },
  forecast: {
    averageDealValue: 1200,
    lowConversionRate: 10,
    mediumConversionRate: 20,
    highConversionRate: 35
  },
  timeouts: {
    enrichmentMs: 5000,
    notificationMs: 5000
  },
  rateLimits: {
    windowMs: 60000,
    maxRequests: 120
  },
  batch: {
    size: 1000
  },
  cache: {
    ttlMs: 30000
  }
};

export class SettingsService {
  constructor(private readonly database: Database) {}

  async featureFlags(organizationId?: string): Promise<FeatureFlags> {
    const stored = await this.readRecord<Partial<FeatureFlags>>('feature_flags', organizationId);
    return {
      ...defaultFeatureFlags,
      ...stored
    };
  }

  async updateFeatureFlags(
    organizationId: string | undefined,
    flags: FeatureFlagUpdates
  ): Promise<FeatureFlags> {
    const next = await this.featureFlags(organizationId);
    for (const key of featureFlagKeys) {
      if (typeof flags[key] === 'boolean') {
        next[key] = flags[key];
      }
    }
    await this.upsertRecord('feature_flags', organizationId, next);
    return next;
  }

  async runtimeSettings(organizationId?: string): Promise<RuntimeSettings> {
    const stored = await this.readRecord<Partial<RuntimeSettings>>(
      'runtime_settings',
      organizationId
    );
    return mergeSettings(defaultRuntimeSettings, stored);
  }

  async updateRuntimeSettings(
    organizationId: string | undefined,
    settings: RuntimeSettingsUpdate
  ): Promise<RuntimeSettings> {
    const next = mergeSettings(await this.runtimeSettings(organizationId), settings);
    await this.upsertRecord('runtime_settings', organizationId, next);
    return next;
  }

  async isEnabled(key: FeatureFlagKey, organizationId?: string): Promise<boolean> {
    return (await this.featureFlags(organizationId))[key];
  }

  private async readRecord<T>(key: string, organizationId?: string): Promise<T | null> {
    if (!this.database.isConfigured()) return null;
    const result = await this.database.query<{ value: T }>(
      `
      select value
      from app_settings
      where key = $1 and (($2::uuid is null and organization_id is null) or organization_id = $2)
      order by organization_id nulls last
      limit 1
      `,
      [key, organizationId ?? null]
    );

    return result.rows[0]?.value ?? null;
  }

  private async upsertRecord(
    key: string,
    organizationId: string | undefined,
    value: unknown
  ): Promise<void> {
    if (!this.database.isConfigured()) return;
    if (!organizationId) {
      const updated = await this.database.query(
        `
        update app_settings
        set value = $2::jsonb, updated_at = now()
        where key = $1 and organization_id is null
        `,
        [key, JSON.stringify(value)]
      );

      if ((updated.rowCount ?? 0) > 0) return;

      await this.database.query(
        `
        insert into app_settings (id, organization_id, key, value, updated_at)
        values ($1, null, $2, $3::jsonb, now())
        `,
        [randomUUID(), key, JSON.stringify(value)]
      );
      return;
    }

    await this.database.query(
      `
      insert into app_settings (id, organization_id, key, value, updated_at)
      values ($1, $2, $3, $4::jsonb, now())
      on conflict (organization_id, key)
      do update set value = excluded.value, updated_at = now()
      `,
      [randomUUID(), organizationId ?? null, key, JSON.stringify(value)]
    );
  }
}

function mergeSettings(
  base: RuntimeSettings,
  partial: RuntimeSettingsUpdate | null
): RuntimeSettings {
  if (!partial) return base;

  return {
    scoring: mergeNumberSettings(base.scoring, partial.scoring),
    pipeline: mergeNumberSettings(base.pipeline, partial.pipeline),
    forecast: mergeNumberSettings(base.forecast, partial.forecast),
    timeouts: mergeNumberSettings(base.timeouts, partial.timeouts),
    rateLimits: mergeNumberSettings(base.rateLimits, partial.rateLimits),
    batch: mergeNumberSettings(base.batch, partial.batch),
    cache: mergeNumberSettings(base.cache, partial.cache)
  };
}

function mergeNumberSettings<T extends Record<string, number>>(
  base: T,
  partial: UpdateShape<T> | undefined
): T {
  const next = { ...base };
  if (!partial) return next;

  for (const key of Object.keys(base) as Array<keyof T>) {
    const value = partial[key];
    if (typeof value === 'number') {
      next[key] = value as T[typeof key];
    }
  }

  return next;
}
