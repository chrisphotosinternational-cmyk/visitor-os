import { randomUUID } from 'node:crypto';
import type { Database } from '../../database/client.js';
import type { ProspectRecord, ProspectStatus } from '../prospects/prospect-repository.js';

export const pipelineStages = [
  'new',
  'to_qualify',
  'to_contact',
  'contacted',
  'follow_up',
  'interested',
  'potential_client',
  'signed_client',
  'refused',
  'blacklist'
] as const satisfies readonly ProspectStatus[];

export type PipelineStage = (typeof pipelineStages)[number];

export type PipelineFilters = {
  organizationId?: string;
  city?: string;
  scoreLabel?: string;
  source?: string;
  platform?: string;
  userId?: string;
  sort?: 'score' | 'follow_up' | 'created_at';
};

export type ForecastConfig = {
  averageDealValue?: number;
  lowConversionRate?: number;
  mediumConversionRate?: number;
  highConversionRate?: number;
};

export type PipelineColumn = {
  stage: PipelineStage;
  label: string;
  count: number;
  prospects: Array<PipelineProspectCard>;
};

export type PipelineProspectCard = Pick<
  ProspectRecord,
  | 'id'
  | 'organization_id'
  | 'display_name'
  | 'pseudo'
  | 'email'
  | 'phone'
  | 'city'
  | 'status'
  | 'score'
  | 'score_label'
  | 'created_at'
  | 'updated_at'
> & {
  platform: string | null;
  next_follow_up_at: Date | null;
};

export type PipelineMetrics = {
  byStage: Array<{ stage: PipelineStage; count: number }>;
  contactedToInterestedRate: number;
  interestedToSignedRate: number;
  newToSignedRate: number;
  averageFirstContactToInterestDays: number | null;
  averageInterestToSignedDays: number | null;
  stalledProspects: number;
  overdueFollowUps: number;
  neverContacted: number;
  topCitiesByPotential: Array<{ city: string; count: number; potential: number }>;
  topPlatformsByPotential: Array<{ platform: string; count: number; potential: number }>;
};

export type PipelineForecast = {
  highPriorityUncontacted: number;
  interested: number;
  potentialClients: number;
  baseProspects: number;
  averageDealValue: number;
  lowConversionRate: number;
  mediumConversionRate: number;
  highConversionRate: number;
  lowEstimate: number;
  mediumEstimate: number;
  highEstimate: number;
};

export type CrmActivityLogRecord = {
  id: string;
  organization_id: string;
  user_id: string | null;
  prospect_id: string | null;
  action_type: string;
  previous_value: string | null;
  new_value: string | null;
  metadata: unknown;
  created_at: Date;
  prospect_display_name?: string | null;
  user_email?: string | null;
};

export class SalesPipelineService {
  constructor(private readonly database: Database) {}

  async list(filters: PipelineFilters = {}): Promise<{ columns: PipelineColumn[]; stages: readonly PipelineStage[] }> {
    const result = await this.database.query<PipelineProspectCard>(
      `
      select
        p.id,
        p.organization_id,
        p.display_name,
        p.pseudo,
        p.email,
        p.phone,
        p.city,
        p.status,
        p.score,
        p.score_label,
        p.created_at,
        p.updated_at,
        case
          when p.mym is not null and p.mym <> '' then 'mym'
          when p.onlyfans is not null and p.onlyfans <> '' then 'onlyfans'
          when p.instagram is not null and p.instagram <> '' then 'instagram'
          when p.twitter_x is not null and p.twitter_x <> '' then 'twitter_x'
          when p.linktree is not null and p.linktree <> '' then 'linktree'
          when p.allmylinks is not null and p.allmylinks <> '' then 'allmylinks'
          when p.website is not null and p.website <> '' then 'website'
          else null
        end as platform,
        (
          select min(ch.follow_up_date)
          from contact_history ch
          where ch.prospect_id = p.id and ch.follow_up_date is not null
        ) as next_follow_up_at
      from prospects p
      where
        ($1::uuid is null or p.organization_id = $1)
        and ($2::text is null or p.city ilike $2)
        and ($3::text is null or p.score_label = $3)
        and ($4::text is null or p.source = $4)
        and (
          $5::text is null
          or ($5 = 'instagram' and p.instagram is not null and p.instagram <> '')
          or ($5 = 'twitter_x' and p.twitter_x is not null and p.twitter_x <> '')
          or ($5 = 'mym' and p.mym is not null and p.mym <> '')
          or ($5 = 'onlyfans' and p.onlyfans is not null and p.onlyfans <> '')
          or ($5 = 'website' and p.website is not null and p.website <> '')
          or ($5 = 'linktree' and p.linktree is not null and p.linktree <> '')
          or ($5 = 'allmylinks' and p.allmylinks is not null and p.allmylinks <> '')
        )
        and (
          $6::uuid is null
          or exists (
            select 1 from contact_history ch
            where ch.prospect_id = p.id and ch.user_id = $6
          )
        )
      order by
        case when $7::text = 'score' then p.score end desc nulls last,
        case when $7::text = 'follow_up' then (
          select min(ch.follow_up_date)
          from contact_history ch
          where ch.prospect_id = p.id and ch.follow_up_date is not null
        ) end asc nulls last,
        p.created_at desc
      limit 500
      `,
      [
        filters.organizationId ?? null,
        filters.city ? `%${filters.city}%` : null,
        filters.scoreLabel ?? null,
        filters.source ?? null,
        filters.platform ?? null,
        filters.userId ?? null,
        filters.sort ?? 'score'
      ]
    );

    return {
      stages: pipelineStages,
      columns: pipelineStages.map((stage) => {
        const prospects = result.rows.filter((prospect) => prospect.status === stage).slice(0, 50);
        return {
          stage,
          label: stageLabel(stage),
          count: result.rows.filter((prospect) => prospect.status === stage).length,
          prospects
        };
      })
    };
  }

  async moveStage(input: {
    prospectId: string;
    organizationId?: string;
    stage: PipelineStage;
    userId?: string;
  }): Promise<ProspectRecord | null> {
    const current = await this.database.query<ProspectRecord>(
      `select * from prospects where id = $1 and ($2::uuid is null or organization_id = $2)`,
      [input.prospectId, input.organizationId ?? null]
    );
    const prospect = current.rows[0];
    if (!prospect) return null;

    const updated = await this.database.query<ProspectRecord>(
      `
      update prospects
      set status = $1, updated_at = now()
      where id = $2 and ($3::uuid is null or organization_id = $3)
      returning *
      `,
      [input.stage, input.prospectId, input.organizationId ?? null]
    );
    const row = updated.rows[0] ?? null;
    if (row && prospect.status !== input.stage) {
      await this.logActivity({
        organizationId: row.organization_id,
        prospectId: row.id,
        actionType: actionTypeForStage(input.stage),
        previousValue: prospect.status,
        newValue: input.stage,
        metadata: { source: 'pipeline' },
        ...(input.userId ? { userId: input.userId } : {})
      });
    }

    return row;
  }

  async metrics(organizationId?: string): Promise<PipelineMetrics> {
    const [stageCounts, conversion, topCities, topPlatforms] = await Promise.all([
      this.database.query<{ stage: PipelineStage; count: string }>(
        `
        select status as stage, count(*)::text as count
        from prospects
        where ($1::uuid is null or organization_id = $1)
        group by status
        `,
        [organizationId ?? null]
      ),
      this.database.query<{
        contacted: string;
        interested: string;
        signed: string;
        total: string;
        stalled: string;
        overdue_followups: string;
        never_contacted: string;
        avg_contact_to_interest_days: string | null;
        avg_interest_to_signed_days: string | null;
      }>(
        `
        select
          count(*) filter (where p.status in ('contacted', 'follow_up', 'interested', 'potential_client', 'signed_client'))::text as contacted,
          count(*) filter (where p.status in ('interested', 'potential_client', 'signed_client'))::text as interested,
          count(*) filter (where p.status = 'signed_client')::text as signed,
          count(*)::text as total,
          count(*) filter (where p.updated_at < now() - interval '14 days' and p.status not in ('signed_client', 'refused', 'blacklist'))::text as stalled,
          (
            select count(*)::text
            from contact_history ch
            where ($1::uuid is null or ch.organization_id = $1)
              and ch.follow_up_date is not null
              and ch.follow_up_date < now()
          ) as overdue_followups,
          count(*) filter (where not exists (select 1 from contact_history ch where ch.prospect_id = p.id))::text as never_contacted,
          null::text as avg_contact_to_interest_days,
          null::text as avg_interest_to_signed_days
        from prospects p
        where ($1::uuid is null or p.organization_id = $1)
        `,
        [organizationId ?? null]
      ),
      this.database.query<{ city: string; count: string; potential: string }>(
        `
        select city, count(*)::text as count, coalesce(sum(score), 0)::text as potential
        from prospects
        where ($1::uuid is null or organization_id = $1)
          and city is not null
          and city <> ''
          and status not in ('refused', 'blacklist')
        group by city
        order by coalesce(sum(score), 0) desc, count(*) desc
        limit 8
        `,
        [organizationId ?? null]
      ),
      this.database.query<{ platform: string; count: string; potential: string }>(
        `
        select platform, count(*)::text as count, coalesce(sum(score), 0)::text as potential
        from (
          select
            score,
            case
              when mym is not null and mym <> '' then 'mym'
              when onlyfans is not null and onlyfans <> '' then 'onlyfans'
              when instagram is not null and instagram <> '' then 'instagram'
              when twitter_x is not null and twitter_x <> '' then 'twitter_x'
              when linktree is not null and linktree <> '' then 'linktree'
              when allmylinks is not null and allmylinks <> '' then 'allmylinks'
              when website is not null and website <> '' then 'website'
              else 'none'
            end as platform
          from prospects
          where ($1::uuid is null or organization_id = $1)
            and status not in ('refused', 'blacklist')
        ) platforms
        where platform <> 'none'
        group by platform
        order by coalesce(sum(score), 0) desc, count(*) desc
        limit 8
        `,
        [organizationId ?? null]
      )
    ]);
    const row = conversion.rows[0];
    const contacted = Number(row?.contacted ?? 0);
    const interested = Number(row?.interested ?? 0);
    const signed = Number(row?.signed ?? 0);
    const total = Number(row?.total ?? 0);

    return {
      byStage: pipelineStages.map((stage) => ({
        stage,
        count: Number(stageCounts.rows.find((item) => item.stage === stage)?.count ?? 0)
      })),
      contactedToInterestedRate: percent(interested, contacted),
      interestedToSignedRate: percent(signed, interested),
      newToSignedRate: percent(signed, total),
      averageFirstContactToInterestDays: nullableNumber(row?.avg_contact_to_interest_days),
      averageInterestToSignedDays: nullableNumber(row?.avg_interest_to_signed_days),
      stalledProspects: Number(row?.stalled ?? 0),
      overdueFollowUps: Number(row?.overdue_followups ?? 0),
      neverContacted: Number(row?.never_contacted ?? 0),
      topCitiesByPotential: topCities.rows.map((item) => ({
        city: item.city,
        count: Number(item.count),
        potential: Number(item.potential)
      })),
      topPlatformsByPotential: topPlatforms.rows.map((item) => ({
        platform: item.platform,
        count: Number(item.count),
        potential: Number(item.potential)
      }))
    };
  }

  async forecast(
    organizationId?: string,
    config: ForecastConfig = {}
  ): Promise<PipelineForecast> {
    const averageDealValue = positiveNumber(config.averageDealValue, 1200);
    const lowConversionRate = positiveNumber(config.lowConversionRate, 10);
    const mediumConversionRate = positiveNumber(config.mediumConversionRate, 20);
    const highConversionRate = positiveNumber(config.highConversionRate, 35);
    const result = await this.database.query<{
      high_priority_uncontacted: string;
      interested: string;
      potential_clients: string;
    }>(
      `
      select
        count(*) filter (where score_label in ('high', 'very_high') and status in ('new', 'to_qualify', 'to_contact'))::text as high_priority_uncontacted,
        count(*) filter (where status = 'interested')::text as interested,
        count(*) filter (where status = 'potential_client')::text as potential_clients
      from prospects
      where ($1::uuid is null or organization_id = $1)
      `,
      [organizationId ?? null]
    );
    const row = result.rows[0];
    const highPriorityUncontacted = Number(row?.high_priority_uncontacted ?? 0);
    const interested = Number(row?.interested ?? 0);
    const potentialClients = Number(row?.potential_clients ?? 0);
    const baseProspects = highPriorityUncontacted + interested + potentialClients;

    return {
      highPriorityUncontacted,
      interested,
      potentialClients,
      baseProspects,
      averageDealValue,
      lowConversionRate,
      mediumConversionRate,
      highConversionRate,
      lowEstimate: estimate(baseProspects, averageDealValue, lowConversionRate),
      mediumEstimate: estimate(baseProspects, averageDealValue, mediumConversionRate),
      highEstimate: estimate(baseProspects, averageDealValue, highConversionRate)
    };
  }

  async activity(filters: {
    organizationId?: string;
    prospectId?: string;
    actionType?: string;
    userId?: string;
  } = {}): Promise<CrmActivityLogRecord[]> {
    const result = await this.database.query<CrmActivityLogRecord>(
      `
      select
        a.*,
        p.display_name as prospect_display_name,
        u.email as user_email
      from crm_activity_log a
      left join prospects p on p.id = a.prospect_id
      left join users u on u.id = a.user_id
      where
        ($1::uuid is null or a.organization_id = $1)
        and ($2::uuid is null or a.prospect_id = $2)
        and ($3::text is null or a.action_type = $3)
        and ($4::uuid is null or a.user_id = $4)
      order by a.created_at desc
      limit 100
      `,
      [
        filters.organizationId ?? null,
        filters.prospectId ?? null,
        filters.actionType ?? null,
        filters.userId ?? null
      ]
    );

    return result.rows;
  }

  async logActivity(input: {
    organizationId: string;
    userId?: string;
    prospectId?: string;
    actionType: string;
    previousValue?: string | null;
    newValue?: string | null;
    metadata?: unknown;
  }): Promise<CrmActivityLogRecord> {
    const result = await this.database.query<CrmActivityLogRecord>(
      `
      insert into crm_activity_log (
        id,
        organization_id,
        user_id,
        prospect_id,
        action_type,
        previous_value,
        new_value,
        metadata
      )
      values ($1, $2, $3, $4, $5, $6, $7, $8::jsonb)
      returning *
      `,
      [
        randomUUID(),
        input.organizationId,
        input.userId ?? null,
        input.prospectId ?? null,
        input.actionType,
        input.previousValue ?? null,
        input.newValue ?? null,
        JSON.stringify(input.metadata ?? {})
      ]
    );

    return requireRow(result.rows[0], 'CRM activity was not created');
  }
}

export function actionTypeForStage(stage: PipelineStage): string {
  if (stage === 'signed_client') return 'prospect_signed';
  if (stage === 'blacklist') return 'prospect_blacklisted';
  return 'pipeline_stage_changed';
}

function stageLabel(stage: PipelineStage): string {
  return {
    new: 'Nouveau',
    to_qualify: 'A qualifier',
    to_contact: 'A contacter',
    contacted: 'Contacte',
    follow_up: 'Relance',
    interested: 'Interesse',
    potential_client: 'Client potentiel',
    signed_client: 'Client signe',
    refused: 'Refuse',
    blacklist: 'Blacklist'
  }[stage];
}

function percent(value: number, total: number): number {
  return total > 0 ? Math.round((value / total) * 100) : 0;
}

function nullableNumber(value: string | null | undefined): number | null {
  if (!value) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.round(parsed * 10) / 10 : null;
}

function positiveNumber(value: number | undefined, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0 ? value : fallback;
}

function estimate(prospects: number, averageDealValue: number, rate: number): number {
  return Math.round(prospects * averageDealValue * (rate / 100));
}

function requireRow<T>(row: T | undefined, message: string): T {
  if (!row) throw new Error(message);

  return row;
}
