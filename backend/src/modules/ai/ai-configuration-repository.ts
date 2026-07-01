import type { Database } from '../../database/client.js';
import { defaultAIConfiguration, normalizeAIConfiguration } from './ai-config.js';
import type { AIProviderConfiguration } from './ai-provider.js';

export type AIConfigurationRecord = AIProviderConfiguration & {
  organizationId: string;
  createdAt: Date;
  updatedAt: Date;
};

export class AIConfigurationRepository {
  constructor(private readonly database: Database) {}

  async findByOrganizationId(organizationId: string): Promise<AIProviderConfiguration | null> {
    const result = await this.database.query<{
      provider: string;
      model: string;
      temperature: number;
      max_tokens: number;
      top_p: number;
      timeout_ms: number;
      language: string;
      system_prompt: string;
      enabled: boolean;
      future_cost_limit: number | null;
    }>(
      `
      select
        provider,
        model,
        temperature,
        max_tokens,
        top_p,
        timeout_ms,
        language,
        system_prompt,
        enabled,
        future_cost_limit
      from ai_configurations
      where organization_id = $1
      `,
      [organizationId]
    );
    const row = result.rows[0];

    if (!row) {
      return null;
    }

    return normalizeAIConfiguration({
      provider: row.provider as AIProviderConfiguration['provider'],
      model: row.model,
      temperature: Number(row.temperature),
      maxTokens: row.max_tokens,
      topP: Number(row.top_p),
      timeoutMs: row.timeout_ms,
      language: row.language,
      systemPrompt: row.system_prompt,
      enabled: row.enabled,
      futureCostLimit: row.future_cost_limit === null ? null : Number(row.future_cost_limit)
    });
  }

  async getByOrganizationId(organizationId: string): Promise<AIProviderConfiguration> {
    return (await this.findByOrganizationId(organizationId)) ?? defaultAIConfiguration;
  }

  async save(
    organizationId: string,
    configuration: AIProviderConfiguration
  ): Promise<AIProviderConfiguration> {
    const normalized = normalizeAIConfiguration(configuration);
    const result = await this.database.query<{
      provider: string;
      model: string;
      temperature: number;
      max_tokens: number;
      top_p: number;
      timeout_ms: number;
      language: string;
      system_prompt: string;
      enabled: boolean;
      future_cost_limit: number | null;
    }>(
      `
      insert into ai_configurations (
        organization_id,
        provider,
        model,
        temperature,
        max_tokens,
        top_p,
        timeout_ms,
        language,
        system_prompt,
        enabled,
        future_cost_limit
      )
      values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
      on conflict (organization_id)
      do update set
        provider = excluded.provider,
        model = excluded.model,
        temperature = excluded.temperature,
        max_tokens = excluded.max_tokens,
        top_p = excluded.top_p,
        timeout_ms = excluded.timeout_ms,
        language = excluded.language,
        system_prompt = excluded.system_prompt,
        enabled = excluded.enabled,
        future_cost_limit = excluded.future_cost_limit,
        updated_at = now()
      returning
        provider,
        model,
        temperature,
        max_tokens,
        top_p,
        timeout_ms,
        language,
        system_prompt,
        enabled,
        future_cost_limit
      `,
      [
        organizationId,
        normalized.provider,
        normalized.model,
        normalized.temperature,
        normalized.maxTokens,
        normalized.topP,
        normalized.timeoutMs,
        normalized.language,
        normalized.systemPrompt,
        normalized.enabled,
        normalized.futureCostLimit
      ]
    );
    const row = result.rows[0];

    return normalizeAIConfiguration({
      provider: row?.provider as AIProviderConfiguration['provider'],
      model: row?.model ?? defaultAIConfiguration.model,
      temperature:
        row?.temperature === undefined
          ? defaultAIConfiguration.temperature
          : Number(row.temperature),
      maxTokens: row?.max_tokens ?? defaultAIConfiguration.maxTokens,
      topP: row?.top_p === undefined ? defaultAIConfiguration.topP : Number(row.top_p),
      timeoutMs: row?.timeout_ms ?? defaultAIConfiguration.timeoutMs,
      language: row?.language ?? defaultAIConfiguration.language,
      systemPrompt: row?.system_prompt ?? defaultAIConfiguration.systemPrompt,
      enabled: row?.enabled ?? defaultAIConfiguration.enabled,
      futureCostLimit:
        row?.future_cost_limit === null || row?.future_cost_limit === undefined
          ? null
          : Number(row.future_cost_limit)
    });
  }
}
