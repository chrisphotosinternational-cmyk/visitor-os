import { createHash } from 'node:crypto';
import { hostname } from 'node:os';
import process from 'node:process';
import type { AppConfig } from '../../core/config/env.js';
import type { AppCache } from '../../core/cache/app-cache.js';
import type { InMemoryJobQueue } from '../../core/jobs/in-memory-job-queue.js';
import type { Database } from '../../database/client.js';
import { hashPassword } from '../auth/password.js';
import {
  scoreLabel,
  scoreProspect,
  type ProspectInput,
  type ProspectStatus
} from '../prospects/prospect-repository.js';

const demoOrganizationId = '00000000-0000-4000-8000-00000000d015';
const demoSiteId = '00000000-0000-4000-8000-00000000d115';
const demoUserId = '00000000-0000-4000-8000-00000000d215';

export type ProductionValidationDependencies = {
  database: Database;
  config: AppConfig;
  cache?: AppCache;
  queue?: InMemoryJobQueue;
  readiness?: {
    database: 'disabled' | 'pending' | 'ok' | 'error';
  };
  startedAt?: Date;
};

type CleanupPreview = {
  totalProspects: number;
  trimSpaces: number;
  normalizeEmails: number;
  normalizePhones: number;
  normalizeUrls: number;
  simpleDuplicates: number;
  samples: Array<{ id: string; field: string; before: string | null; after: string | null }>;
};

export class ProductionValidationService {
  constructor(private readonly dependencies: ProductionValidationDependencies) {}

  async firstStartStatus(): Promise<{
    requiresOnboarding: boolean;
    organizationsCount: number;
    steps: Array<{ key: string; label: string; completed: boolean }>;
  }> {
    const organizationsCount = await this.count('organizations', `status <> 'deleted'`);

    return {
      requiresOnboarding: organizationsCount === 0,
      organizationsCount,
      steps: [
        { key: 'welcome', label: 'Bienvenue', completed: true },
        { key: 'organization', label: 'Créer organisation', completed: organizationsCount > 0 },
        {
          key: 'administrator',
          label: 'Créer administrateur',
          completed: (await this.count('users')) > 0
        },
        { key: 'import', label: 'Importer CSV', completed: (await this.count('prospects')) > 0 },
        {
          key: 'dashboard',
          label: 'Tableau de bord',
          completed: organizationsCount > 0 && (await this.count('users')) > 0
        }
      ]
    };
  }

  async createDemoProject(): Promise<{
    organization: { id: string; name: string; slug: string };
    user: { email: string; password: string };
    createdProspects: number;
    contacts: number;
    followUps: number;
    signed: number;
    refused: number;
  }> {
    await this.ensureDemoOrganization();
    await this.ensureDemoUser();
    await this.ensureDemoProspects();
    await this.ensureDemoContactHistory();

    return {
      organization: {
        id: demoOrganizationId,
        name: 'VISITOR DEMO',
        slug: 'visitor-demo'
      },
      user: {
        email: 'demo@visitor-os.app',
        password: 'demo123'
      },
      createdProspects: await this.count('prospects', `organization_id = $1`, [demoOrganizationId]),
      contacts: await this.count('contact_history', `organization_id = $1`, [demoOrganizationId]),
      followUps: await this.count(
        'contact_history',
        `organization_id = $1 and follow_up_date is not null`,
        [demoOrganizationId]
      ),
      signed: await this.count('prospects', `organization_id = $1 and status = 'signed_client'`, [
        demoOrganizationId
      ]),
      refused: await this.count('prospects', `organization_id = $1 and status = 'refused'`, [
        demoOrganizationId
      ])
    };
  }

  async diagnostics(): Promise<Record<string, unknown>> {
    const startedAt = this.dependencies.startedAt ?? new Date(Date.now() - process.uptime() * 1000);
    const started = Date.now();
    const database = await this.checkDatabaseLatency();

    return {
      database,
      queue: this.dependencies.queue?.stats() ?? { enabled: false },
      cache: this.dependencies.cache?.stats() ?? { enabled: false },
      openTelemetry: {
        enabled: this.dependencies.config.observability?.openTelemetryEnabled ?? true,
        serviceName: this.dependencies.config.observability?.serviceName ?? 'visitor-os-backend'
      },
      variables: {
        APP_VERSION: Boolean(process.env.APP_VERSION),
        NODE_ENV: process.env.NODE_ENV ?? 'development',
        DATABASE_URL: Boolean(process.env.DATABASE_URL),
        RAILWAY_ENVIRONMENT: Boolean(process.env.RAILWAY_ENVIRONMENT),
        RAILWAY_SERVICE_NAME: Boolean(process.env.RAILWAY_SERVICE_NAME)
      },
      version: process.env.APP_VERSION ?? 'dev',
      railway: {
        service: process.env.RAILWAY_SERVICE_NAME ?? null,
        environment: process.env.RAILWAY_ENVIRONMENT ?? null,
        deploymentId: process.env.RAILWAY_DEPLOYMENT_ID ?? null
      },
      permissions: {
        databaseConfigured: this.dependencies.database.isConfigured(),
        readiness: this.dependencies.readiness?.database ?? 'unknown'
      },
      runtime: {
        node: process.version,
        host: hostname(),
        uptimeSeconds: Math.round((Date.now() - startedAt.getTime()) / 1000)
      },
      responseTimeMs: Date.now() - started
    };
  }

  about(): Record<string, unknown> {
    return {
      version: process.env.APP_VERSION ?? 'dev',
      commit: process.env.RAILWAY_GIT_COMMIT_SHA ?? process.env.GIT_COMMIT_SHA ?? 'unknown',
      buildDate: process.env.RAILWAY_DEPLOYMENT_CREATED_AT ?? new Date().toISOString(),
      railway: {
        service: process.env.RAILWAY_SERVICE_NAME ?? null,
        environment: process.env.RAILWAY_ENVIRONMENT ?? null,
        deploymentId: process.env.RAILWAY_DEPLOYMENT_ID ?? null
      },
      node: process.version,
      postgresql: this.dependencies.readiness?.database ?? 'unknown',
      license: 'MIT',
      documentation: '/docs'
    };
  }

  importIntelligence(csv: string): {
    rows: number;
    duplicates: number;
    invalidEmails: number;
    invalidPhones: number;
    unknownCities: number;
    ignoredColumns: string[];
    correctionProposals: string[];
  } {
    const parsed = parseCsv(csv);
    const known = new Set([
      'first_name',
      'last_name',
      'pseudo',
      'company',
      'email',
      'phone',
      'website',
      'instagram',
      'twitter_x',
      'mym',
      'onlyfans',
      'linktree',
      'allmylinks',
      'city',
      'activity',
      'description',
      'source_url',
      'status',
      'notes'
    ]);
    const seen = new Set<string>();
    const duplicates = parsed.rows.filter((row) => {
      const key = [row.email, normalizePhone(row.phone), row.source_url, row.pseudo, row.city]
        .map((value) => normalizeText(value))
        .join('|');
      if (!key.replaceAll('|', '')) return false;
      if (seen.has(key)) return true;
      seen.add(key);
      return false;
    }).length;
    const invalidEmails = parsed.rows.filter(
      (row) => row.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(row.email.trim())
    ).length;
    const invalidPhones = parsed.rows.filter(
      (row) => row.phone && normalizePhone(row.phone).length < 8
    ).length;
    const unknownCities = parsed.rows.filter((row) => !row.city?.trim()).length;

    return {
      rows: parsed.rows.length,
      duplicates,
      invalidEmails,
      invalidPhones,
      unknownCities,
      ignoredColumns: parsed.headers.filter((header) => !known.has(header)),
      correctionProposals: [
        invalidEmails > 0 ? 'Corriger ou supprimer les emails invalides avant import.' : '',
        invalidPhones > 0 ? 'Normaliser les téléphones courts ou incomplets.' : '',
        unknownCities > 0 ? 'Compléter les villes quand elles sont disponibles publiquement.' : '',
        duplicates > 0 ? 'Fusionner les doublons probables avant validation finale.' : ''
      ].filter(Boolean)
    };
  }

  async cleanupPreview(organizationId: string): Promise<CleanupPreview> {
    const result = await this.dependencies.database.query<{
      id: string;
      email: string | null;
      phone: string | null;
      website: string | null;
      source_url: string | null;
      first_name: string | null;
      last_name: string | null;
      pseudo: string | null;
      city: string | null;
    }>(
      `
      select id, email, phone, website, source_url, first_name, last_name, pseudo, city
      from prospects
      where organization_id = $1
      order by updated_at desc
      limit 500
      `,
      [organizationId]
    );
    const samples: Array<{
      id: string;
      field: string;
      before: string | null;
      after: string | null;
    }> = [];
    let trimSpaces = 0;
    let normalizeEmails = 0;
    let normalizePhones = 0;
    let normalizeUrls = 0;
    const duplicateKeys = new Set<string>();
    let simpleDuplicates = 0;

    for (const row of result.rows) {
      for (const field of ['first_name', 'last_name', 'pseudo', 'city'] as const) {
        const trimmed = cleanSpaces(row[field]);
        if (row[field] && row[field] !== trimmed) {
          trimSpaces += 1;
          pushSample(samples, row.id, field, row[field], trimmed);
        }
      }

      const email = row.email?.trim().toLowerCase() ?? null;
      if (row.email && row.email !== email) {
        normalizeEmails += 1;
        pushSample(samples, row.id, 'email', row.email, email);
      }

      const phone = normalizePhone(row.phone);
      if (row.phone && row.phone !== phone) {
        normalizePhones += 1;
        pushSample(samples, row.id, 'phone', row.phone, phone);
      }

      const website = normalizeUrl(row.website);
      if (row.website && row.website !== website) {
        normalizeUrls += 1;
        pushSample(samples, row.id, 'website', row.website, website);
      }

      const duplicateKey = [
        email,
        phone,
        normalizeText(row.source_url),
        normalizeText(row.pseudo),
        normalizeText(row.city)
      ]
        .filter(Boolean)
        .join('|');
      if (duplicateKey && duplicateKeys.has(duplicateKey)) simpleDuplicates += 1;
      if (duplicateKey) duplicateKeys.add(duplicateKey);
    }

    return {
      totalProspects: result.rows.length,
      trimSpaces,
      normalizeEmails,
      normalizePhones,
      normalizeUrls,
      simpleDuplicates,
      samples
    };
  }

  async applyCleanup(
    organizationId: string
  ): Promise<{ updated: number; preview: CleanupPreview }> {
    const preview = await this.cleanupPreview(organizationId);
    const result = await this.dependencies.database.query(
      `
      update prospects
      set
        first_name = nullif(trim(regexp_replace(coalesce(first_name, ''), '\\s+', ' ', 'g')), ''),
        last_name = nullif(trim(regexp_replace(coalesce(last_name, ''), '\\s+', ' ', 'g')), ''),
        pseudo = nullif(trim(regexp_replace(coalesce(pseudo, ''), '\\s+', ' ', 'g')), ''),
        city = nullif(initcap(trim(regexp_replace(coalesce(city, ''), '\\s+', ' ', 'g'))), ''),
        email = nullif(lower(trim(coalesce(email, ''))), ''),
        phone = nullif(regexp_replace(coalesce(phone, ''), '[^0-9+]', '', 'g'), ''),
        website = nullif(trim(coalesce(website, '')), ''),
        source_url = nullif(trim(coalesce(source_url, '')), ''),
        updated_at = now()
      where organization_id = $1
      `,
      [organizationId]
    );

    return { updated: result.rowCount ?? 0, preview };
  }

  async qualityReport(organizationId: string): Promise<Record<string, unknown>> {
    const summary = await this.dependencies.database.query<{
      total: string;
      incomplete: string;
      without_contact: string;
      never_contacted: string;
      average_score: string | null;
      invalid_email: string;
      missing_city: string;
    }>(
      `
      select
        count(*)::text as total,
        count(*) filter (where first_name is null and last_name is null and pseudo is null)::text as incomplete,
        count(*) filter (where coalesce(email, '') = '' and coalesce(phone, '') = '')::text as without_contact,
        count(*) filter (where not exists (select 1 from contact_history ch where ch.prospect_id = prospects.id))::text as never_contacted,
        round(avg(score))::text as average_score,
        count(*) filter (where email is not null and email !~ '^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$')::text as invalid_email,
        count(*) filter (where coalesce(city, '') = '')::text as missing_city
      from prospects
      where organization_id = $1
      `,
      [organizationId]
    );
    const row = summary.rows[0];
    const total = Number(row?.total ?? 0);
    const errors =
      Number(row?.invalid_email ?? 0) +
      Number(row?.without_contact ?? 0) +
      Number(row?.missing_city ?? 0);
    const completeness = total === 0 ? 100 : Math.max(0, Math.round(100 - (errors / total) * 20));

    return {
      errors,
      incompleteData: Number(row?.incomplete ?? 0),
      prospectsWithoutContact: Number(row?.without_contact ?? 0),
      prospectsNeverFollowedUp: Number(row?.never_contacted ?? 0),
      averageScore: Number(row?.average_score ?? 0),
      crmQuality: completeness,
      recommendations: [
        Number(row?.without_contact ?? 0) > 0
          ? 'Compléter les moyens de contact prioritaires.'
          : '',
        Number(row?.missing_city ?? 0) > 0
          ? 'Ajouter les villes pour améliorer la priorisation.'
          : '',
        Number(row?.never_contacted ?? 0) > 0
          ? 'Planifier une première relance pour les prospects jamais contactés.'
          : ''
      ].filter(Boolean)
    };
  }

  async fullBackup(organizationId: string): Promise<{ filename: string; content: Buffer }> {
    const [organization, users, prospects, history, templates, pipeline, settings] =
      await Promise.all([
        this.rows('organizations', organizationId),
        this.rows('users', organizationId),
        this.rows('prospects', organizationId),
        this.rows('contact_history', organizationId),
        this.rows('message_templates', organizationId),
        this.rows('crm_activity_log', organizationId),
        this.rows('app_settings', organizationId)
      ]);
    const payload = JSON.stringify(
      {
        exportedAt: new Date().toISOString(),
        format: 'visitor-os-backup-v1',
        organization,
        users: users.map(sanitizeUserBackup),
        prospects,
        history,
        templates,
        pipeline,
        settings
      },
      null,
      2
    );
    const content = createZip([{ filename: 'visitor-os-backup.json', content: payload }]);

    return {
      filename: `visitor-os-backup-${new Date().toISOString().slice(0, 10)}.zip`,
      content
    };
  }

  private async ensureDemoOrganization(): Promise<void> {
    await this.dependencies.database.query(
      `
      insert into organizations (
        id, name, slug, description, email, phone, country, language, timezone, currency, status, plan
      )
      values (
        $1, 'VISITOR DEMO', 'visitor-demo', 'Campagne de validation production',
        'demo@visitor-os.app', '+33100000000', 'FR', 'fr', 'Europe/Paris', 'EUR', 'active', 'demo'
      )
      on conflict (slug) do update set
        name = excluded.name,
        description = excluded.description,
        email = excluded.email,
        status = 'active'
      `,
      [demoOrganizationId]
    );
    await this.dependencies.database.query(
      `
      insert into sites (
        id, organization_id, name, slug, domain, widget_public_key, activity, business_config_id,
        language, status, widget_enabled
      )
      values (
        $1, $2, 'VISITOR DEMO Site', 'visitor-demo-site', 'visitor-demo.local',
        'visitor-demo-widget-key', 'production-validation', 'default', 'fr', 'active', true
      )
      on conflict (widget_public_key) do nothing
      `,
      [demoSiteId, demoOrganizationId]
    );
  }

  private async ensureDemoUser(): Promise<void> {
    const passwordHash = await hashPassword('demo123');
    await this.dependencies.database.query(
      `
      insert into users (
        id, organization_id, first_name, last_name, email, password_hash, role, status
      )
      values ($1, $2, 'Demo', 'Visitor', 'demo@visitor-os.app', $3, 'Admin', 'active')
      on conflict (organization_id, email) do update set
        password_hash = excluded.password_hash,
        role = 'Admin',
        status = 'active',
        updated_at = now()
      `,
      [demoUserId, demoOrganizationId, passwordHash]
    );
  }

  private async ensureDemoProspects(): Promise<void> {
    const current = await this.count('prospects', `organization_id = $1`, [demoOrganizationId]);
    if (current >= 200) return;

    const missing = 200 - current;
    for (let index = 0; index < missing; index += 1) {
      const absoluteIndex = current + index + 1;
      const input = demoProspect(absoluteIndex);
      const scored = scoreProspect(input);
      await this.dependencies.database.query(
        `
        insert into prospects (
          id, organization_id, site_id, first_name, last_name, pseudo, company, display_name,
          email, phone, website, instagram, twitter_x, mym, onlyfans, linktree, allmylinks,
          city, activity, description, source_url, status, score_current, score, score_label,
          notes, source
        )
        values (
          $1, $2, $3, $4, $5, $6, $7, $8,
          $9, $10, $11, $12, $13, $14, $15, $16, $17,
          $18, $19, $20, $21, $22, $23, $24, $25,
          $26, 'demo'
        )
        `,
        [
          demoProspectId(absoluteIndex),
          demoOrganizationId,
          demoSiteId,
          input.firstName ?? null,
          input.lastName ?? null,
          input.pseudo ?? null,
          input.company ?? null,
          displayName(input),
          input.email ?? null,
          input.phone ?? null,
          input.website ?? null,
          input.instagram ?? null,
          input.twitterX ?? null,
          input.mym ?? null,
          input.onlyfans ?? null,
          input.linktree ?? null,
          input.allmylinks ?? null,
          input.city ?? null,
          input.activity ?? null,
          input.description ?? null,
          input.sourceUrl ?? null,
          demoStatus(absoluteIndex),
          scored.score,
          scored.score,
          scoreLabel(scored.score),
          input.notes ?? null
        ]
      );
    }
  }

  private async ensureDemoContactHistory(): Promise<void> {
    const current = await this.count('contact_history', `organization_id = $1`, [
      demoOrganizationId
    ]);
    if (current >= 20) return;

    for (let index = current + 1; index <= 20; index += 1) {
      await this.dependencies.database.query(
        `
        insert into contact_history (
          id, organization_id, prospect_id, user_id, contact_date, channel, message_used,
          response, outcome, next_action, follow_up_date, notes
        )
        values ($1, $2, $3, $4, now() - ($5::int || ' days')::interval, $6, $7, $8, $9, $10, $11, $12)
        `,
        [
          stableUuid(`demo-contact-${index}`),
          demoOrganizationId,
          demoProspectId(index),
          demoUserId,
          index,
          index % 3 === 0 ? 'phone' : 'email',
          'Message de validation campagne VISITOR-OS.',
          index % 4 === 0 ? 'Réponse positive, à suivre.' : null,
          demoOutcome(index),
          index <= 10 ? 'Relancer manuellement' : null,
          index <= 10 ? new Date(Date.now() + (index - 5) * 86400000) : null,
          'Historique fictif généré pour validation production.'
        ]
      );
    }
  }

  private async checkDatabaseLatency(): Promise<{ state: string; latencyMs: number | null }> {
    if (!this.dependencies.database.isConfigured()) return { state: 'disabled', latencyMs: null };
    const started = Date.now();
    try {
      await this.dependencies.database.query('select 1');
      return { state: 'ok', latencyMs: Date.now() - started };
    } catch {
      return { state: 'error', latencyMs: Date.now() - started };
    }
  }

  private async count(table: string, where?: string, params: unknown[] = []): Promise<number> {
    const result = await this.dependencies.database.query<{ count: string }>(
      `select count(*)::text as count from ${table}${where ? ` where ${where}` : ''}`,
      params
    );

    return Number(result.rows[0]?.count ?? 0);
  }

  private async rows(
    table: string,
    organizationId: string
  ): Promise<Array<Record<string, unknown>>> {
    const result = await this.dependencies.database.query<Record<string, unknown>>(
      `select * from ${table} where organization_id = $1 limit 5000`,
      [organizationId]
    );

    return result.rows;
  }
}

function demoProspect(index: number): ProspectInput {
  const firstNames = ['Emma', 'Lina', 'Chloe', 'Sarah', 'Maya', 'Nina', 'Lea', 'Julie'];
  const lastNames = ['Martin', 'Bernard', 'Petit', 'Durand', 'Moreau', 'Simon', 'Laurent'];
  const cities = ['Albi', 'Toulouse', 'Paris', 'Lyon', 'Bordeaux', 'Montpellier', 'Nantes'];
  const firstName = firstNames[index % firstNames.length] ?? 'Demo';
  const lastName = lastNames[index % lastNames.length] ?? 'Prospect';
  const pseudo = `${firstName.toLowerCase()}${index}`;

  return {
    organizationId: demoOrganizationId,
    firstName,
    lastName,
    pseudo,
    city: cities[index % cities.length] ?? 'Albi',
    activity: index % 2 === 0 ? 'Créatrice de contenu' : 'Modèle photo',
    description:
      'Profil fictif réaliste utilisé pour valider le CRM, les relances, le pipeline et les rapports qualité.',
    sourceUrl: `https://demo.visitor-os.app/prospects/${index}`,
    status: demoStatus(index),
    notes: 'Donnée de démonstration sans personne réelle.',
    ...(index % 7 === 0 ? {} : { email: `${pseudo}@example.com` }),
    ...(index % 5 === 0 ? {} : { phone: `+336${String(10000000 + index).slice(0, 8)}` }),
    ...(index % 4 === 0 ? { website: `https://portfolio-${pseudo}.example.com` } : {}),
    ...(index % 2 === 0 ? { instagram: `https://instagram.com/${pseudo}` } : {}),
    ...(index % 9 === 0 ? { twitterX: `https://x.com/${pseudo}` } : {}),
    ...(index % 6 === 0 ? { mym: `https://mym.fans/${pseudo}` } : {}),
    ...(index % 8 === 0 ? { onlyfans: `https://onlyfans.com/${pseudo}` } : {}),
    ...(index % 3 === 0 ? { linktree: `https://linktr.ee/${pseudo}` } : {}),
    ...(index % 11 === 0 ? { allmylinks: `https://allmylinks.com/${pseudo}` } : {})
  };
}

function demoStatus(index: number): ProspectStatus {
  if (index <= 5) return 'signed_client';
  if (index <= 10) return 'refused';
  if (index % 9 === 0) return 'interested';
  if (index % 6 === 0) return 'follow_up';
  if (index % 4 === 0) return 'contacted';
  return 'to_contact';
}

function demoOutcome(index: number) {
  if (index <= 5) return 'booked';
  if (index <= 10) return 'negative';
  if (index % 3 === 0) return 'interested';
  return 'follow_up_needed';
}

function demoProspectId(index: number): string {
  return stableUuid(`demo-prospect-${index}`);
}

function stableUuid(value: string): string {
  const hash = createHash('sha256').update(value).digest('hex');
  return `${hash.slice(0, 8)}-${hash.slice(8, 12)}-4${hash.slice(13, 16)}-8${hash.slice(17, 20)}-${hash.slice(20, 32)}`;
}

function displayName(input: ProspectInput): string {
  return [input.firstName, input.lastName].filter(Boolean).join(' ') || input.pseudo || 'Prospect';
}

function parseCsv(csv: string): { headers: string[]; rows: Array<Record<string, string>> } {
  const lines = csv
    .replace(/^\uFEFF/, '')
    .split(/\r?\n/)
    .filter((line) => line.trim().length > 0);
  const headers = (lines.shift() ?? '').split(',').map((header) =>
    header
      .trim()
      .toLowerCase()
      .replace(/[\s-]+/g, '_')
  );
  const rows = lines.map((line) => {
    const cells = line.split(',');
    return Object.fromEntries(headers.map((header, index) => [header, cells[index]?.trim() ?? '']));
  });

  return { headers, rows };
}

function cleanSpaces(value: string | null): string | null {
  const cleaned = value?.trim().replace(/\s+/g, ' ') ?? '';
  return cleaned || null;
}

function normalizeText(value: string | null | undefined): string {
  return (
    value
      ?.trim()
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '') ?? ''
  );
}

function normalizePhone(value: string | null | undefined): string {
  return value?.replace(/[^\d+]/g, '').trim() ?? '';
}

function normalizeUrl(value: string | null | undefined): string | null {
  const trimmed = value?.trim();
  if (!trimmed) return null;
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  return `https://${trimmed}`;
}

function pushSample(
  samples: Array<{ id: string; field: string; before: string | null; after: string | null }>,
  id: string,
  field: string,
  before: string | null,
  after: string | null
): void {
  if (samples.length >= 12) return;
  samples.push({ id, field, before, after });
}

function sanitizeUserBackup(user: Record<string, unknown>): Record<string, unknown> {
  const sanitized = { ...user };
  delete sanitized.password_hash;

  return sanitized;
}

function createZip(files: Array<{ filename: string; content: string }>): Buffer {
  const localParts: Buffer[] = [];
  const centralParts: Buffer[] = [];
  let offset = 0;

  for (const file of files) {
    const name = Buffer.from(file.filename, 'utf8');
    const content = Buffer.from(file.content, 'utf8');
    const crc = crc32(content);
    const localHeader = Buffer.alloc(30);
    localHeader.writeUInt32LE(0x04034b50, 0);
    localHeader.writeUInt16LE(20, 4);
    localHeader.writeUInt16LE(0, 6);
    localHeader.writeUInt16LE(0, 8);
    localHeader.writeUInt16LE(0, 10);
    localHeader.writeUInt16LE(0, 12);
    localHeader.writeUInt32LE(crc, 14);
    localHeader.writeUInt32LE(content.length, 18);
    localHeader.writeUInt32LE(content.length, 22);
    localHeader.writeUInt16LE(name.length, 26);
    localHeader.writeUInt16LE(0, 28);
    localParts.push(localHeader, name, content);

    const centralHeader = Buffer.alloc(46);
    centralHeader.writeUInt32LE(0x02014b50, 0);
    centralHeader.writeUInt16LE(20, 4);
    centralHeader.writeUInt16LE(20, 6);
    centralHeader.writeUInt16LE(0, 8);
    centralHeader.writeUInt16LE(0, 10);
    centralHeader.writeUInt16LE(0, 12);
    centralHeader.writeUInt16LE(0, 14);
    centralHeader.writeUInt32LE(crc, 16);
    centralHeader.writeUInt32LE(content.length, 20);
    centralHeader.writeUInt32LE(content.length, 24);
    centralHeader.writeUInt16LE(name.length, 28);
    centralHeader.writeUInt16LE(0, 30);
    centralHeader.writeUInt16LE(0, 32);
    centralHeader.writeUInt16LE(0, 34);
    centralHeader.writeUInt16LE(0, 36);
    centralHeader.writeUInt32LE(0, 38);
    centralHeader.writeUInt32LE(offset, 42);
    centralParts.push(centralHeader, name);
    offset += localHeader.length + name.length + content.length;
  }

  const centralDirectory = Buffer.concat(centralParts);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(0, 4);
  end.writeUInt16LE(0, 6);
  end.writeUInt16LE(files.length, 8);
  end.writeUInt16LE(files.length, 10);
  end.writeUInt32LE(centralDirectory.length, 12);
  end.writeUInt32LE(offset, 16);
  end.writeUInt16LE(0, 20);

  return Buffer.concat([...localParts, centralDirectory, end]);
}

function crc32(buffer: Buffer): number {
  let crc = 0xffffffff;
  for (const byte of buffer) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit += 1) {
      crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0);
    }
  }

  return (crc ^ 0xffffffff) >>> 0;
}
