import { randomUUID } from 'node:crypto';
import type { Database } from '../../database/client.js';
import type { ProspectRecord } from '../prospects/prospect-repository.js';

export type AIQualificationPriority = 'very_high' | 'high' | 'medium' | 'low';

export type AIQualificationResult = {
  summary: string;
  strengths: string[];
  weaknesses: string[];
  opportunities: string[];
  risks: string[];
  commercial_opportunity: string;
  recommended_offer: string;
  priority: AIQualificationPriority;
  confidence: number;
};

export type ProspectAIAnalysisRecord = {
  id: string;
  organization_id: string;
  prospect_id: string;
  summary: string;
  strengths: string[];
  weaknesses: string[];
  opportunities: string[];
  risks: string[];
  commercial_opportunity?: string;
  recommended_offer: string;
  priority: AIQualificationPriority;
  confidence: number;
  created_at: Date;
  updated_at: Date;
};

export type AIQualificationMetrics = {
  analyzedProspects: number;
  pendingAnalyses: number;
  averageConfidence: number;
  priorityOpportunities: number;
  topProspects: Array<{
    prospectId: string;
    displayName: string;
    priority: AIQualificationPriority;
    confidence: number;
    recommendedOffer: string;
  }>;
};

export type AIQualificationBatchJob = {
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

const batchJobs = new Map<string, AIQualificationBatchJob>();

export class AIQualificationService {
  constructor(private readonly database: Database) {}

  async analyzeProspect(prospect: ProspectRecord): Promise<ProspectAIAnalysisRecord> {
    const analysis = qualifyProspect(prospect);
    const result = await this.database.query<ProspectAIAnalysisRecord>(
      `
      insert into prospect_ai_analysis (
        id,
        organization_id,
        prospect_id,
        summary,
        strengths,
        weaknesses,
        opportunities,
        risks,
        recommended_offer,
        priority,
        confidence
      )
      values ($1, $2, $3, $4, $5::jsonb, $6::jsonb, $7::jsonb, $8::jsonb, $9, $10, $11)
      returning *
      `,
      [
        randomUUID(),
        prospect.organization_id,
        prospect.id,
        analysis.summary,
        JSON.stringify(analysis.strengths),
        JSON.stringify(analysis.weaknesses),
        JSON.stringify(analysis.opportunities),
        JSON.stringify(analysis.risks),
        analysis.recommended_offer,
        analysis.priority,
        analysis.confidence
      ]
    );

    return withCommercialOpportunity(
      requireRow(result.rows[0], 'AI analysis was not created'),
      analysis.commercial_opportunity
    );
  }

  async latestForProspect(
    prospectId: string,
    organizationId?: string
  ): Promise<ProspectAIAnalysisRecord | null> {
    const result = await this.database.query<ProspectAIAnalysisRecord>(
      `
      select *
      from prospect_ai_analysis
      where prospect_id = $1 and ($2::uuid is null or organization_id = $2)
      order by created_at desc
      limit 1
      `,
      [prospectId, organizationId ?? null]
    );

    return result.rows[0] ? withCommercialOpportunity(result.rows[0]) : null;
  }

  async metrics(organizationId?: string): Promise<AIQualificationMetrics> {
    const [summary, topProspects] = await Promise.all([
      this.database.query<{
        analyzed_prospects: string;
        pending_analyses: string;
        average_confidence: string | null;
        priority_opportunities: string;
      }>(
        `
        select
          count(distinct a.prospect_id)::text as analyzed_prospects,
          (
            select count(*)::text
            from prospects p
            where ($1::uuid is null or p.organization_id = $1)
              and not exists (
                select 1 from prospect_ai_analysis pa where pa.prospect_id = p.id
              )
          ) as pending_analyses,
          coalesce(round(avg(a.confidence))::text, '0') as average_confidence,
          count(*) filter (where a.priority in ('very_high', 'high'))::text as priority_opportunities
        from prospect_ai_analysis a
        where ($1::uuid is null or a.organization_id = $1)
        `,
        [organizationId ?? null]
      ),
      this.database.query<{
        prospect_id: string;
        display_name: string;
        priority: AIQualificationPriority;
        confidence: number;
        recommended_offer: string;
      }>(
        `
        select distinct on (a.prospect_id)
          a.prospect_id,
          p.display_name,
          a.priority,
          a.confidence,
          a.recommended_offer
        from prospect_ai_analysis a
        join prospects p on p.id = a.prospect_id
        where ($1::uuid is null or a.organization_id = $1)
        order by a.prospect_id, a.confidence desc, a.created_at desc
        limit 5
        `,
        [organizationId ?? null]
      )
    ]);
    const row = summary.rows[0];

    return {
      analyzedProspects: Number(row?.analyzed_prospects ?? 0),
      pendingAnalyses: Number(row?.pending_analyses ?? 0),
      averageConfidence: Number(row?.average_confidence ?? 0),
      priorityOpportunities: Number(row?.priority_opportunities ?? 0),
      topProspects: topProspects.rows.map((prospect) => ({
        prospectId: prospect.prospect_id,
        displayName: prospect.display_name,
        priority: prospect.priority,
        confidence: Number(prospect.confidence),
        recommendedOffer: prospect.recommended_offer
      }))
    };
  }

  createBatchJob(organizationId: string, total: number): AIQualificationBatchJob {
    const job: AIQualificationBatchJob = {
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

  getBatchJob(jobId: string): AIQualificationBatchJob | null {
    return batchJobs.get(jobId) ?? null;
  }

  async runBatch(jobId: string, prospects: ProspectRecord[]): Promise<void> {
    const job = batchJobs.get(jobId);
    if (!job) return;

    Object.assign(job, { status: 'running', updatedAt: new Date() });
    try {
      for (const prospect of prospects) {
        try {
          await this.analyzeProspect(prospect);
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
      job.error = error instanceof Error ? error.message : 'Batch analysis failed';
      job.updatedAt = new Date();
    }
  }
}

export function qualifyProspect(prospect: ProspectRecord): AIQualificationResult {
  const strengths: string[] = [];
  const weaknesses: string[] = [];
  const opportunities: string[] = [];
  const risks: string[] = [];
  let confidence = 35;

  const contactCount = countPresent([prospect.email, prospect.phone]);
  const socialPlatforms = presentPlatforms(prospect);
  const portfolioLinks = countPresent([prospect.website, prospect.linktree, prospect.allmylinks]);
  const premiumPlatforms = countPresent([prospect.mym, prospect.onlyfans]);
  const hasDescription = textLength(prospect.description) >= 30;
  const hasIdentity = countPresent([prospect.first_name, prospect.last_name, prospect.pseudo, prospect.company]) >= 1;

  if (hasIdentity) {
    strengths.push('Profil identifiable avec une base commerciale exploitable.');
    confidence += 8;
  } else {
    weaknesses.push('Identite commerciale peu lisible.');
    confidence -= 6;
  }

  if (contactCount > 0) {
    strengths.push('Coordonnees publiques disponibles pour un contact manuel.');
    confidence += contactCount * 8;
  } else {
    weaknesses.push('Aucun moyen de contact direct renseigne.');
    risks.push('Prospection difficile sans email ni telephone.');
    confidence -= 18;
  }

  if (socialPlatforms.length > 0) {
    strengths.push(`Presence sociale detectee : ${socialPlatforms.join(', ')}.`);
    confidence += Math.min(18, socialPlatforms.length * 7);
  } else {
    weaknesses.push('Presence sociale non renseignee.');
    confidence -= 5;
  }

  if (portfolioLinks > 0) {
    strengths.push('Portfolio ou page de liens disponible pour evaluer le positionnement.');
    confidence += 8;
  } else {
    weaknesses.push('Portfolio non renseigne, evaluation visuelle limitee.');
  }

  if (premiumPlatforms > 0) {
    opportunities.push('Offre dediee aux creatrices de contenu premium.');
    confidence += 12;
  }

  if (hasDescription) {
    strengths.push('Description suffisamment riche pour comprendre le besoin potentiel.');
    confidence += 8;
  } else {
    weaknesses.push('Description courte ou absente.');
  }

  if (prospect.city) {
    strengths.push(`Localisation exploitable : ${prospect.city}.`);
    confidence += 6;
  } else {
    risks.push('Zone geographique non confirmee.');
  }

  const recommended = recommendedOffer(prospect, premiumPlatforms, portfolioLinks, socialPlatforms);
  opportunities.push(recommended.justification);

  if ((prospect.score ?? 0) >= 80 || premiumPlatforms > 0) {
    opportunities.push('Potentiel commercial prioritaire a verifier manuellement.');
  }

  if (contactCount === 0 && socialPlatforms.length === 0) {
    risks.push('Risque de faible actionnabilite commerciale.');
  }

  confidence = clamp(confidence, 0, 100);
  const priority = priorityFromConfidence(confidence, prospect.score);
  const commercialOpportunity = opportunities[0] ?? 'Opportunite a qualifier manuellement.';

  return {
    summary: buildSummary(prospect, socialPlatforms, commercialOpportunity, risks, recommended.offer, confidence),
    strengths: ensureAtLeast(strengths, 'Profil exploitable apres verification manuelle.'),
    weaknesses: ensureAtLeast(weaknesses, 'Aucune faiblesse majeure detectee dans les donnees disponibles.'),
    opportunities: ensureAtLeast(opportunities, commercialOpportunity),
    risks: ensureAtLeast(risks, 'Aucun risque critique detecte dans les donnees publiques disponibles.'),
    commercial_opportunity: commercialOpportunity,
    recommended_offer: `${recommended.offer} - ${recommended.justification}`,
    priority,
    confidence
  };
}

function recommendedOffer(
  prospect: ProspectRecord,
  premiumPlatforms: number,
  portfolioLinks: number,
  socialPlatforms: string[]
): { offer: string; justification: string } {
  const activity = [prospect.activity, prospect.description].join(' ').toLowerCase();
  if (prospect.mym) return { offer: 'Pack MYM', justification: 'Presence MYM detectee, offre contenu premium adaptee.' };
  if (prospect.onlyfans) return { offer: 'Pack OnlyFans', justification: 'Presence OnlyFans detectee, offre contenu premium adaptee.' };
  if (activity.includes('contenu') || socialPlatforms.length >= 2) {
    return { offer: 'Creation de contenu', justification: 'Presence multi-plateformes utile pour une production reguliere.' };
  }
  if (activity.includes('modele') || activity.includes('portrait')) {
    return { offer: 'Portrait professionnel', justification: 'Profil compatible avec une approche portrait ou modele.' };
  }
  if (portfolioLinks > 0 && premiumPlatforms === 0) {
    return { offer: 'Shooting premium', justification: 'Portfolio disponible, potentiel de proposition plus qualitative.' };
  }
  if (activity.includes('pub') || activity.includes('marque')) {
    return { offer: 'Publicite', justification: 'Indices de positionnement commercial ou marque.' };
  }
  if (prospect.score >= 70) {
    return { offer: 'Collaboration artistique', justification: 'Score CRM eleve et profil interessant pour une prise de contact respectueuse.' };
  }

  return { offer: 'Shooting decouverte', justification: 'Offre simple pour qualifier l interet sans pression commerciale.' };
}

function buildSummary(
  prospect: ProspectRecord,
  socialPlatforms: string[],
  commercialOpportunity: string,
  risks: string[],
  recommendedOffer: string,
  confidence: number
): string {
  return [
    `${prospect.display_name} est un prospect ${prospect.score_label} avec un score CRM de ${prospect.score}.`,
    prospect.activity ? `Activite detectee : ${prospect.activity}.` : 'Activite a confirmer manuellement.',
    prospect.city ? `Localisation indiquee : ${prospect.city}.` : 'Localisation non renseignee.',
    prospect.email || prospect.phone
      ? `Moyens de contact : ${[prospect.email ? 'email' : '', prospect.phone ? 'telephone' : ''].filter(Boolean).join(', ')}.`
      : 'Aucun moyen de contact direct renseigne.',
    socialPlatforms.length > 0
      ? `Plateformes presentes : ${socialPlatforms.join(', ')}.`
      : 'Aucune plateforme sociale renseignee.',
    commercialOpportunity,
    risks.length > 0 ? `Risque principal : ${risks[0]}.` : 'Risque principal faible dans les donnees disponibles.',
    `Offre recommandee : ${recommendedOffer}.`,
    `Indice de confiance : ${confidence}/100.`
  ].join('\n');
}

function presentPlatforms(prospect: ProspectRecord): string[] {
  return [
    prospect.instagram ? 'Instagram' : '',
    prospect.twitter_x ? 'X' : '',
    prospect.mym ? 'MYM' : '',
    prospect.onlyfans ? 'OnlyFans' : '',
    prospect.website ? 'Site web' : '',
    prospect.linktree ? 'Linktree' : '',
    prospect.allmylinks ? 'AllMyLinks' : ''
  ].filter(Boolean);
}

function countPresent(values: Array<string | null | undefined>): number {
  return values.filter((value) => Boolean(value && value.trim())).length;
}

function textLength(value: string | null | undefined): number {
  return value?.trim().length ?? 0;
}

function priorityFromConfidence(confidence: number, score: number): AIQualificationPriority {
  if (confidence >= 80 || score >= 85) return 'very_high';
  if (confidence >= 65 || score >= 70) return 'high';
  if (confidence >= 40 || score >= 40) return 'medium';
  return 'low';
}

function ensureAtLeast(values: string[], fallback: string): string[] {
  return values.length > 0 ? values : [fallback];
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function requireRow<T>(row: T | undefined, message: string): T {
  if (!row) throw new Error(message);
  return row;
}

function withCommercialOpportunity(
  row: ProspectAIAnalysisRecord,
  commercialOpportunity?: string
): ProspectAIAnalysisRecord {
  return {
    ...row,
    commercial_opportunity:
      commercialOpportunity ?? row.opportunities[0] ?? 'Opportunite a qualifier manuellement.'
  };
}
