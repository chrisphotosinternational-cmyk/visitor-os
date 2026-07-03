import { randomUUID } from 'node:crypto';
import type { Database } from '../../database/client.js';
import type { ProspectRecord } from '../prospects/prospect-repository.js';

export const enrichmentSourceTypes = [
  'website',
  'instagram_public',
  'x_public',
  'linktree',
  'allmylinks',
  'mym_public',
  'onlyfans_public',
  'other'
] as const;

export const enrichmentStatuses = [
  'pending',
  'success',
  'partial',
  'failed',
  'blocked',
  'skipped'
] as const;

export const suggestionStatuses = ['pending', 'accepted', 'rejected'] as const;

export type EnrichmentSourceType = (typeof enrichmentSourceTypes)[number];
export type EnrichmentStatus = (typeof enrichmentStatuses)[number];
export type SuggestionStatus = (typeof suggestionStatuses)[number];

export type ProspectEnrichmentRecord = {
  id: string;
  organization_id: string;
  prospect_id: string;
  source_type: EnrichmentSourceType;
  source_url: string;
  page_title: string | null;
  meta_description: string | null;
  detected_emails: string[];
  detected_phones: string[];
  detected_social_links: string[];
  detected_platforms: string[];
  detected_location: string | null;
  detected_activity: string | null;
  extracted_summary: string | null;
  confidence_score: number;
  status: EnrichmentStatus;
  error_message: string | null;
  created_at: Date;
  updated_at: Date;
};

export type ProspectFieldSuggestionRecord = {
  id: string;
  organization_id: string;
  prospect_id: string;
  field_name: string;
  current_value: string | null;
  suggested_value: string;
  source_url: string;
  confidence_score: number;
  status: SuggestionStatus;
  created_at: Date;
  updated_at: Date;
};

export type EnrichmentMetrics = {
  enrichedProspects: number;
  successful: number;
  partial: number;
  blocked: number;
  pendingSuggestions: number;
  detectedEmails: number;
  detectedPhones: number;
  topPlatforms: Array<{ platform: string; count: number }>;
};

export type EnrichmentBatchJob = {
  id: string;
  organizationId: string;
  status: 'queued' | 'running' | 'completed' | 'failed';
  total: number;
  completed: number;
  failed: number;
  createdAt: Date;
  updatedAt: Date;
  error?: string;
};

export type EnrichmentListFilters = {
  organizationId?: string;
  status?: EnrichmentStatus;
  sourceType?: EnrichmentSourceType;
  city?: string;
  platform?: string;
  confidenceMin?: number;
};

type Fetcher = (url: string, init: RequestInit) => Promise<Response>;

type EnrichmentOptions = {
  fetcher?: Fetcher;
  timeoutMs?: number;
  maxPagesPerProspect?: number;
  delayMs?: number;
  userAgent?: string;
};

const batchJobs = new Map<string, EnrichmentBatchJob>();

export class PublicEnrichmentService {
  private readonly fetcher: Fetcher;
  private readonly timeoutMs: number;
  private readonly maxPagesPerProspect: number;
  private readonly delayMs: number;
  private readonly userAgent: string;

  constructor(
    private readonly database: Database,
    options: EnrichmentOptions = {}
  ) {
    this.fetcher = options.fetcher ?? fetch;
    this.timeoutMs = options.timeoutMs ?? 5000;
    this.maxPagesPerProspect = options.maxPagesPerProspect ?? 4;
    this.delayMs = options.delayMs ?? 100;
    this.userAgent = options.userAgent ?? 'VISITOR-OS Public Enrichment Bot/1.0';
  }

  async enrichProspect(prospect: ProspectRecord): Promise<ProspectEnrichmentRecord[]> {
    const sources = detectPublicSources(prospect).slice(0, this.maxPagesPerProspect);
    if (sources.length === 0) {
      return [
        await this.saveEnrichment({
          prospect,
          sourceType: 'other',
          sourceUrl: '',
          status: 'skipped',
          confidenceScore: 0,
          errorMessage: 'No public URL available for this prospect'
        })
      ];
    }

    const results: ProspectEnrichmentRecord[] = [];
    for (const source of sources) {
      results.push(await this.enrichSource(prospect, source));
      if (this.delayMs > 0) await delay(this.delayMs);
    }

    return results;
  }

  async enrichSource(
    prospect: ProspectRecord,
    source: { type: EnrichmentSourceType; url: string }
  ): Promise<ProspectEnrichmentRecord> {
    if (!isPublicHttpUrl(source.url) || isBlockedSourceUrl(source.url)) {
      return this.saveEnrichment({
        prospect,
        sourceType: source.type,
        sourceUrl: source.url,
        status: 'blocked',
        confidenceScore: 0,
        errorMessage: 'URL is not a public HTTP page or appears protected'
      });
    }

    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), this.timeoutMs);
      const response = await this.fetcher(source.url, {
        method: 'GET',
        headers: {
          accept: 'text/html,application/xhtml+xml,text/plain;q=0.9,*/*;q=0.5',
          'user-agent': this.userAgent
        },
        redirect: 'follow',
        signal: controller.signal
      });
      clearTimeout(timeout);

      if ([401, 403, 429].includes(response.status)) {
        return this.saveEnrichment({
          prospect,
          sourceType: source.type,
          sourceUrl: source.url,
          status: 'blocked',
          confidenceScore: 0,
          errorMessage: `Public access blocked with HTTP ${response.status}`
        });
      }

      if (!response.ok) {
        return this.saveEnrichment({
          prospect,
          sourceType: source.type,
          sourceUrl: source.url,
          status: 'failed',
          confidenceScore: 0,
          errorMessage: `HTTP ${response.status}`
        });
      }

      const html = await response.text();
      const extracted = extractPublicProfileData(html, source.url);
      const confidenceScore = confidenceFromExtracted(extracted);
      const status: EnrichmentStatus = confidenceScore >= 45 ? 'success' : 'partial';
      const enrichment = await this.saveEnrichment({
        prospect,
        sourceType: source.type,
        sourceUrl: source.url,
        ...extracted,
        status,
        confidenceScore
      });
      await this.createSuggestions(prospect, enrichment);

      return enrichment;
    } catch (error) {
      return this.saveEnrichment({
        prospect,
        sourceType: source.type,
        sourceUrl: source.url,
        status: 'failed',
        confidenceScore: 0,
        errorMessage: error instanceof Error ? error.message : 'Public enrichment failed'
      });
    }
  }

  async list(filters: EnrichmentListFilters = {}): Promise<ProspectEnrichmentRecord[]> {
    const result = await this.database.query<ProspectEnrichmentRecord>(
      `
      select *
      from prospect_enrichments
      where ($1::uuid is null or organization_id = $1)
        and ($2::text is null or status = $2)
        and ($3::text is null or source_type = $3)
        and ($4::integer is null or confidence_score >= $4)
        and ($5::text is null or coalesce(detected_location, '') ilike $5)
        and ($6::text is null or detected_platforms ? $6)
      order by created_at desc
      limit 200
      `,
      [
        filters.organizationId ?? null,
        filters.status ?? null,
        filters.sourceType ?? null,
        filters.confidenceMin ?? null,
        filters.city ? `%${filters.city}%` : null,
        filters.platform ?? null
      ]
    );

    return result.rows;
  }

  async find(id: string, organizationId?: string): Promise<ProspectEnrichmentRecord | null> {
    const result = await this.database.query<ProspectEnrichmentRecord>(
      `select * from prospect_enrichments where id = $1 and ($2::uuid is null or organization_id = $2)`,
      [id, organizationId ?? null]
    );

    return result.rows[0] ?? null;
  }

  async listForProspect(prospectId: string, organizationId?: string): Promise<ProspectEnrichmentRecord[]> {
    const result = await this.database.query<ProspectEnrichmentRecord>(
      `
      select *
      from prospect_enrichments
      where prospect_id = $1 and ($2::uuid is null or organization_id = $2)
      order by created_at desc
      `,
      [prospectId, organizationId ?? null]
    );

    return result.rows;
  }

  async delete(id: string, organizationId?: string): Promise<boolean> {
    const result = await this.database.query(
      `delete from prospect_enrichments where id = $1 and ($2::uuid is null or organization_id = $2)`,
      [id, organizationId ?? null]
    );

    return (result.rowCount ?? 0) > 0;
  }

  async suggestionsForProspect(
    prospectId: string,
    organizationId?: string
  ): Promise<ProspectFieldSuggestionRecord[]> {
    const result = await this.database.query<ProspectFieldSuggestionRecord>(
      `
      select *
      from prospect_field_suggestions
      where prospect_id = $1 and ($2::uuid is null or organization_id = $2)
      order by created_at desc
      `,
      [prospectId, organizationId ?? null]
    );

    return result.rows;
  }

  async acceptSuggestion(
    suggestionId: string,
    prospect: ProspectRecord
  ): Promise<{ suggestion: ProspectFieldSuggestionRecord | null; prospect: ProspectRecord | null }> {
    const suggestion = await this.findSuggestion(suggestionId, prospect.organization_id);
    if (!suggestion || suggestion.prospect_id !== prospect.id || suggestion.status !== 'pending') {
      return { suggestion: null, prospect: null };
    }

    const updated = await this.applySuggestion(prospect, suggestion);
    const statusResult = await this.database.query<ProspectFieldSuggestionRecord>(
      `
      update prospect_field_suggestions
      set status = 'accepted', updated_at = now()
      where id = $1 and organization_id = $2
      returning *
      `,
      [suggestionId, prospect.organization_id]
    );

    return { suggestion: statusResult.rows[0] ?? null, prospect: updated };
  }

  async rejectSuggestion(
    suggestionId: string,
    organizationId: string
  ): Promise<ProspectFieldSuggestionRecord | null> {
    const result = await this.database.query<ProspectFieldSuggestionRecord>(
      `
      update prospect_field_suggestions
      set status = 'rejected', updated_at = now()
      where id = $1 and organization_id = $2
      returning *
      `,
      [suggestionId, organizationId]
    );

    return result.rows[0] ?? null;
  }

  async metrics(organizationId?: string): Promise<EnrichmentMetrics> {
    const [summary, platforms] = await Promise.all([
      this.database.query<{
        enriched_prospects: string;
        successful: string;
        partial: string;
        blocked: string;
        pending_suggestions: string;
        detected_emails: string;
        detected_phones: string;
      }>(
        `
        select
          count(distinct e.prospect_id)::text as enriched_prospects,
          count(*) filter (where e.status = 'success')::text as successful,
          count(*) filter (where e.status = 'partial')::text as partial,
          count(*) filter (where e.status = 'blocked')::text as blocked,
          (
            select count(*)::text
            from prospect_field_suggestions s
            where ($1::uuid is null or s.organization_id = $1)
              and s.status = 'pending'
          ) as pending_suggestions,
          coalesce(sum(jsonb_array_length(e.detected_emails)), 0)::text as detected_emails,
          coalesce(sum(jsonb_array_length(e.detected_phones)), 0)::text as detected_phones
        from prospect_enrichments e
        where ($1::uuid is null or e.organization_id = $1)
        `,
        [organizationId ?? null]
      ),
      this.database.query<{ platform: string; count: string }>(
        `
        select platform, count(*)::text as count
        from prospect_enrichments e
        cross join lateral jsonb_array_elements_text(e.detected_platforms) as platform
        where ($1::uuid is null or e.organization_id = $1)
        group by platform
        order by count(*) desc, platform asc
        limit 8
        `,
        [organizationId ?? null]
      )
    ]);
    const row = summary.rows[0];

    return {
      enrichedProspects: Number(row?.enriched_prospects ?? 0),
      successful: Number(row?.successful ?? 0),
      partial: Number(row?.partial ?? 0),
      blocked: Number(row?.blocked ?? 0),
      pendingSuggestions: Number(row?.pending_suggestions ?? 0),
      detectedEmails: Number(row?.detected_emails ?? 0),
      detectedPhones: Number(row?.detected_phones ?? 0),
      topPlatforms: platforms.rows.map((platform) => ({
        platform: platform.platform,
        count: Number(platform.count)
      }))
    };
  }

  createBatchJob(organizationId: string, total: number): EnrichmentBatchJob {
    const job: EnrichmentBatchJob = {
      id: randomUUID(),
      organizationId,
      status: 'queued',
      total,
      completed: 0,
      failed: 0,
      createdAt: new Date(),
      updatedAt: new Date()
    };
    batchJobs.set(job.id, job);

    return job;
  }

  getBatchJob(jobId: string): EnrichmentBatchJob | null {
    return batchJobs.get(jobId) ?? null;
  }

  async runBatch(jobId: string, prospects: ProspectRecord[]): Promise<void> {
    const job = batchJobs.get(jobId);
    if (!job) return;

    Object.assign(job, { status: 'running', updatedAt: new Date() });
    try {
      for (const prospect of prospects) {
        try {
          await this.enrichProspect(prospect);
          job.completed += 1;
        } catch {
          job.failed += 1;
        }
        job.updatedAt = new Date();
      }
      job.status = 'completed';
      job.updatedAt = new Date();
    } catch (error) {
      job.status = 'failed';
      job.error = error instanceof Error ? error.message : 'Batch enrichment failed';
      job.updatedAt = new Date();
    }
  }

  private async saveEnrichment(input: {
    prospect: ProspectRecord;
    sourceType: EnrichmentSourceType;
    sourceUrl: string;
    pageTitle?: string | null;
    metaDescription?: string | null;
    detectedEmails?: string[];
    detectedPhones?: string[];
    detectedSocialLinks?: string[];
    detectedPlatforms?: string[];
    detectedLocation?: string | null;
    detectedActivity?: string | null;
    extractedSummary?: string | null;
    confidenceScore: number;
    status: EnrichmentStatus;
    errorMessage?: string | null;
  }): Promise<ProspectEnrichmentRecord> {
    const result = await this.database.query<ProspectEnrichmentRecord>(
      `
      insert into prospect_enrichments (
        id,
        organization_id,
        prospect_id,
        source_type,
        source_url,
        page_title,
        meta_description,
        detected_emails,
        detected_phones,
        detected_social_links,
        detected_platforms,
        detected_location,
        detected_activity,
        extracted_summary,
        confidence_score,
        status,
        error_message
      )
      values ($1, $2, $3, $4, $5, $6, $7, $8::jsonb, $9::jsonb, $10::jsonb, $11::jsonb, $12, $13, $14, $15, $16, $17)
      returning *
      `,
      [
        randomUUID(),
        input.prospect.organization_id,
        input.prospect.id,
        input.sourceType,
        input.sourceUrl,
        input.pageTitle ?? null,
        input.metaDescription ?? null,
        JSON.stringify(input.detectedEmails ?? []),
        JSON.stringify(input.detectedPhones ?? []),
        JSON.stringify(input.detectedSocialLinks ?? []),
        JSON.stringify(input.detectedPlatforms ?? []),
        input.detectedLocation ?? null,
        input.detectedActivity ?? null,
        input.extractedSummary ?? null,
        input.confidenceScore,
        input.status,
        input.errorMessage ?? null
      ]
    );

    return requireRow(result.rows[0], 'Enrichment was not created');
  }

  private async createSuggestions(
    prospect: ProspectRecord,
    enrichment: ProspectEnrichmentRecord
  ): Promise<void> {
    const candidates: Array<{ fieldName: string; currentValue: string | null; suggestedValue: string }> = [
      {
        fieldName: 'email',
        currentValue: prospect.email,
        suggestedValue: enrichment.detected_emails[0] ?? ''
      },
      {
        fieldName: 'phone',
        currentValue: prospect.phone,
        suggestedValue: enrichment.detected_phones[0] ?? ''
      },
      {
        fieldName: 'city',
        currentValue: prospect.city,
        suggestedValue: enrichment.detected_location ?? ''
      },
      {
        fieldName: 'activity',
        currentValue: prospect.activity,
        suggestedValue: enrichment.detected_activity ?? ''
      },
      {
        fieldName: 'description',
        currentValue: prospect.description,
        suggestedValue: enrichment.extracted_summary ?? ''
      }
    ];

    for (const candidate of candidates) {
      if (!candidate.suggestedValue || candidate.currentValue) continue;
      await this.database.query<ProspectFieldSuggestionRecord>(
        `
        insert into prospect_field_suggestions (
          id,
          organization_id,
          prospect_id,
          field_name,
          current_value,
          suggested_value,
          source_url,
          confidence_score,
          status
        )
        values ($1, $2, $3, $4, $5, $6, $7, $8, 'pending')
        returning *
        `,
        [
          randomUUID(),
          prospect.organization_id,
          prospect.id,
          candidate.fieldName,
          candidate.currentValue,
          candidate.suggestedValue,
          enrichment.source_url,
          enrichment.confidence_score
        ]
      );
    }
  }

  private async findSuggestion(
    suggestionId: string,
    organizationId?: string
  ): Promise<ProspectFieldSuggestionRecord | null> {
    const result = await this.database.query<ProspectFieldSuggestionRecord>(
      `select * from prospect_field_suggestions where id = $1 and ($2::uuid is null or organization_id = $2)`,
      [suggestionId, organizationId ?? null]
    );

    return result.rows[0] ?? null;
  }

  private async applySuggestion(
    prospect: ProspectRecord,
    suggestion: ProspectFieldSuggestionRecord
  ): Promise<ProspectRecord | null> {
    const allowedFields = new Set(['email', 'phone', 'city', 'activity', 'description']);
    if (!allowedFields.has(suggestion.field_name)) return null;
    const result = await this.database.query<ProspectRecord>(
      `
      update prospects
      set
        email = case when $3 = 'email' then $4 else email end,
        phone = case when $3 = 'phone' then $4 else phone end,
        city = case when $3 = 'city' then $4 else city end,
        activity = case when $3 = 'activity' then $4 else activity end,
        description = case when $3 = 'description' then $4 else description end,
        updated_at = now()
      where id = $1 and organization_id = $2
      returning *
      `,
      [prospect.id, prospect.organization_id, suggestion.field_name, suggestion.suggested_value]
    );

    return result.rows[0] ?? null;
  }
}

export function detectPublicSources(
  prospect: ProspectRecord
): Array<{ type: EnrichmentSourceType; url: string }> {
  return [
    { type: 'website' as const, url: prospect.website },
    { type: 'instagram_public' as const, url: normalizeHandleUrl(prospect.instagram, 'https://www.instagram.com/') },
    { type: 'x_public' as const, url: normalizeHandleUrl(prospect.twitter_x, 'https://x.com/') },
    { type: 'linktree' as const, url: normalizeHandleUrl(prospect.linktree, 'https://linktr.ee/') },
    { type: 'allmylinks' as const, url: normalizeHandleUrl(prospect.allmylinks, 'https://allmylinks.com/') },
    { type: 'mym_public' as const, url: normalizeHandleUrl(prospect.mym, 'https://mym.fans/') },
    { type: 'onlyfans_public' as const, url: normalizeHandleUrl(prospect.onlyfans, 'https://onlyfans.com/') },
    { type: 'other' as const, url: prospect.source_url }
  ].filter((source): source is { type: EnrichmentSourceType; url: string } => Boolean(source.url));
}

export function extractPublicProfileData(html: string, sourceUrl: string) {
  const text = decodeHtml(stripTags(html)).replace(/\s+/g, ' ').trim();
  const title = matchFirst(html, /<title[^>]*>([\s\S]*?)<\/title>/i);
  const metaDescription =
    matchFirst(html, /<meta[^>]+name=["']description["'][^>]+content=["']([^"']*)["'][^>]*>/i) ??
    matchFirst(html, /<meta[^>]+content=["']([^"']*)["'][^>]+name=["']description["'][^>]*>/i);
  const emails = uniqueMatches(html, /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi);
  const phones = uniqueMatches(text, /(?:\+|00)?\d[\d .()/-]{7,}\d/g).slice(0, 5);
  const socialLinks = extractLinks(html, sourceUrl).filter((url) =>
    /(instagram\.com|x\.com|twitter\.com|linktr\.ee|allmylinks\.com|mym\.fans|onlyfans\.com)/i.test(url)
  );
  const platforms = detectPlatforms([sourceUrl, ...socialLinks, text].join(' '));
  const location = detectLocation(text);
  const activity = detectActivity(text);
  const summarySource = [metaDescription, text].filter(Boolean).join(' ');
  const summary = summarySource ? summarySource.slice(0, 300) : null;

  return {
    pageTitle: title ? decodeHtml(title).trim().slice(0, 200) : null,
    metaDescription: metaDescription ? decodeHtml(metaDescription).trim().slice(0, 300) : null,
    detectedEmails: emails.slice(0, 5),
    detectedPhones: phones,
    detectedSocialLinks: socialLinks.slice(0, 12),
    detectedPlatforms: platforms,
    detectedLocation: location,
    detectedActivity: activity,
    extractedSummary: summary
  };
}

function confidenceFromExtracted(extracted: ReturnType<typeof extractPublicProfileData>): number {
  let score = 15;
  if (extracted.pageTitle) score += 10;
  if (extracted.metaDescription) score += 15;
  if (extracted.detectedEmails.length > 0) score += 20;
  if (extracted.detectedPhones.length > 0) score += 20;
  if (extracted.detectedSocialLinks.length > 0) score += 15;
  if (extracted.detectedLocation) score += 10;
  if (extracted.detectedActivity) score += 10;
  return Math.max(0, Math.min(100, score));
}

function normalizeHandleUrl(value: string | null | undefined, baseUrl: string): string | null {
  if (!value) return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  return `${baseUrl}${trimmed.replace(/^@/, '')}`;
}

function isPublicHttpUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return ['http:', 'https:'].includes(url.protocol);
  } catch {
    return false;
  }
}

function isBlockedSourceUrl(value: string): boolean {
  return /(login|signin|signup|account|checkout|paywall|captcha)/i.test(value);
}

function stripTags(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ');
}

function decodeHtml(value: string): string {
  return value
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
}

function matchFirst(value: string, pattern: RegExp): string | null {
  return pattern.exec(value)?.[1] ?? null;
}

function uniqueMatches(value: string, pattern: RegExp): string[] {
  return [...new Set([...value.matchAll(pattern)].map((match) => match[0].trim()))];
}

function extractLinks(html: string, sourceUrl: string): string[] {
  return uniqueMatches(html, /href=["']([^"']+)["']/gi)
    .map((raw) => raw.replace(/^href=["']|["']$/g, ''))
    .map((href) => {
      try {
        return new URL(href, sourceUrl).toString();
      } catch {
        return '';
      }
    })
    .filter(Boolean);
}

function detectPlatforms(value: string): string[] {
  const platforms = [
    ['Instagram', /instagram\.com|instagram/i],
    ['X', /x\.com|twitter\.com|twitter/i],
    ['Linktree', /linktr\.ee|linktree/i],
    ['AllMyLinks', /allmylinks/i],
    ['MYM', /mym\.fans|mym/i],
    ['OnlyFans', /onlyfans/i],
    ['Website', /https?:\/\//i]
  ] as const;
  return platforms.filter(([, pattern]) => pattern.test(value)).map(([label]) => label);
}

function detectLocation(text: string): string | null {
  const city = /(?:ville|city|based in|localisation|location)\s*:?\s*([A-ZÀ-ÿ][A-Za-zÀ-ÿ -]{2,40})/i.exec(text)?.[1];
  return city?.trim() ?? null;
}

function detectActivity(text: string): string | null {
  const lower = text.toLowerCase();
  if (/(photographe|shooting|photo|portrait)/.test(lower)) return 'photographie';
  if (/(modele|model|mannequin)/.test(lower)) return 'modele';
  if (/(createur|creatrice|contenu|content creator)/.test(lower)) return 'creation de contenu';
  if (/(coach|consultant|artist|artiste)/.test(lower)) return 'activite independante';
  return null;
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function requireRow<T>(row: T | undefined, message: string): T {
  if (!row) throw new Error(message);
  return row;
}
