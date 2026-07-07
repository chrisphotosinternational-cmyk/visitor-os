import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import type pg from 'pg';
import type { Database } from '../src/database/client.js';
import { KnowledgeEngineService } from '../src/modules/knowledge-engine/knowledge-engine-service.js';
import { ChatbotStudioService } from '../src/modules/chatbot-studio/chatbot-studio-service.js';

const ORG = '00000000-0000-4000-8000-0000000000a1';
const SITE = '00000000-0000-4000-8000-000000000101';
const USER = '00000000-0000-4000-8000-0000000000f1';

describe('Chatbot Studio', () => {
  it('creates a no-code chatbot draft from a business template', async () => {
    const database = fakeStudioDatabase();
    const studio = new ChatbotStudioService(database, new KnowledgeEngineService(database));

    const result = await studio.createFromWizard({
      organizationId: ORG,
      siteId: SITE,
      name: 'Studio demo',
      domain: 'example.com',
      businessType: 'chambre_hotes',
      primaryGoal: 'reservation',
      tone: 'premium',
      userId: USER
    });
    const dashboard = await studio.dashboard(ORG, SITE);

    assert.equal((result.version as Record<string, unknown>).status, 'draft');
    assert.equal(dashboard.knowledge_items, 0);
    assert.equal(dashboard.draft_version, 1);
  });

  it('turns imported document questions into draft knowledge proposals', async () => {
    const database = fakeStudioDatabase();
    const studio = new ChatbotStudioService(database, new KnowledgeEngineService(database));

    const proposal = await studio.importDocument({
      organizationId: ORG,
      siteId: SITE,
      fileName: 'faq.txt',
      fileType: 'txt',
      content: [
        'Quels sont vos tarifs ?',
        'Les tarifs dependent du projet.',
        'Comment reserver ?',
        'Contactez-nous.'
      ].join('\n')
    });
    assert.equal(proposal.status, 'pending');

    const accepted = await studio.acceptImportProposal(String(proposal.id), ORG, USER);

    assert.equal(accepted.created, 2);
  });

  it('simulates an answer and exposes fallback diagnostics', async () => {
    const database = fakeStudioDatabase();
    const knowledge = new KnowledgeEngineService(database);
    const studio = new ChatbotStudioService(database, knowledge);
    await knowledge.createKnowledge(ORG, SITE, {
      title: 'Parking',
      mainQuestion: 'Avez-vous un parking ?',
      shortAnswer: 'Oui, parking prive.',
      status: 'active',
      userId: USER
    });

    const answer = await studio.simulate({
      organizationId: ORG,
      siteId: SITE,
      message: 'Avez-vous un parking ?'
    });

    assert.equal(answer.fallback, false);
    assert.equal(answer.knowledgeItemId, 'knowledge-1');
  });

  it('publishes and rolls back Studio versions', async () => {
    const database = fakeStudioDatabase();
    const studio = new ChatbotStudioService(database, new KnowledgeEngineService(database));
    await studio.createFromWizard({
      organizationId: ORG,
      siteId: SITE,
      name: 'Studio demo',
      domain: 'example.com',
      businessType: 'photographe',
      primaryGoal: 'devis',
      tone: 'sobre',
      userId: USER
    });

    const published = await studio.publish(ORG, SITE, USER);
    const rolledBack = await studio.rollback(ORG, SITE, Number(published.version_number));

    assert.equal(published.status, 'published');
    assert.equal(rolledBack.status, 'published');
  });
});

function fakeStudioDatabase(): Database {
  const studios = new Map<string, Record<string, unknown>>();
  const versions: Array<Record<string, unknown>> = [];
  const intents: Array<Record<string, unknown>> = [];
  const knowledgeItems: Array<Record<string, unknown>> = [];
  const proposals = new Map<string, Record<string, unknown>>();

  return {
    isConfigured: () => true,
    checkConnection: () => Promise.resolve(),
    close: () => Promise.resolve(),
    async query<T extends pg.QueryResultRow = pg.QueryResultRow>(
      text: string,
      values: unknown[] = []
    ): Promise<pg.QueryResult<T>> {
      const sql = text.replace(/\s+/g, ' ').trim().toLowerCase();

      if (sql.startsWith('insert into chatbot_studios')) {
        studios.set(String(values[2]), {
          id: values[0],
          organization_id: values[1],
          site_id: values[2],
          name: values[3],
          domain: values[4],
          business_type: values[5],
          primary_goal: values[6],
          tone: values[7],
          current_stage: 'draft',
          draft_version: 1,
          published_version: 0,
          last_published_at: null
        });
        return result([]);
      }

      if (sql.startsWith('select s.id as site_id')) {
        const studio = studios.get(SITE);
        return result([
          {
            site_id: SITE,
            organization_id: ORG,
            name: studio?.name ?? 'Site demo',
            domain: studio?.domain ?? 'example.com',
            status: 'active',
            widget_enabled: true,
            current_stage: studio?.current_stage ?? 'draft',
            draft_version: studio?.draft_version ?? 0,
            published_version: studio?.published_version ?? 0,
            last_published_at: studio?.last_published_at ?? null,
            intents: intents.length,
            knowledge_items: knowledgeItems.filter((item) => item.status === 'active').length,
            conversations_today: 0,
            unknown_questions: 0,
            leads_generated: 0,
            answer_rate: 100
          }
        ]);
      }

      if (sql.startsWith('select * from chatbot_template_library')) return result([]);

      if (sql.startsWith('insert into chatbot_intents')) {
        const row = {
          id: `intent-${intents.length + 1}`,
          organization_id: values[1],
          site_id: values[2],
          name: values[3],
          slug: values[4],
          category: values[6],
          examples: values[7],
          synonyms: values[8],
          priority: values[9],
          is_active: values[10]
        };
        intents.push(row);
        return result<T>([row]);
      }

      if (sql.startsWith('insert into knowledge_items')) {
        const row = {
          id: `knowledge-${knowledgeItems.length + 1}`,
          organization_id: values[1],
          site_id: values[2],
          intent_id: values[3],
          title: values[4],
          main_question: values[5],
          alternative_questions: values[6],
          short_answer: values[7],
          tags: values[15],
          priority: values[16],
          status: values[17],
          match_score: 100
        };
        knowledgeItems.push(row);
        return result<T>([row]);
      }

      if (sql.includes('from knowledge_items k')) {
        return result<T>(knowledgeItems.filter((item) => item.status === 'active'));
      }

      if (sql.startsWith('insert into chatbot_personality')) {
        return result<T>([
          { id: values[0], organization_id: values[1], site_id: values[2], tone: values[3] }
        ]);
      }

      if (sql.startsWith('insert into chatbot_goals')) {
        return result<T>([
          { id: values[0], organization_id: values[1], site_id: values[2], goal_type: values[3] }
        ]);
      }

      if (sql.startsWith('select coalesce(max(version_number)')) {
        return result<T>([{ version_number: versions.length + 1 }]);
      }

      if (sql.startsWith('insert into chatbot_studio_versions')) {
        const row = {
          id: values[0],
          organization_id: values[1],
          site_id: values[2],
          version_number: values[3],
          status: values[4],
          snapshot: values[5],
          published_at: values[4] === 'published' ? new Date() : null
        };
        versions.push(row);
        return result<T>([row]);
      }

      if (sql.startsWith('update chatbot_studios')) {
        const studio = studios.get(String(values[1]));
        if (studio) {
          studio.current_stage = values[2] ?? 'published';
          studio.draft_version = values[3] ?? studio.draft_version;
          studio.published_version = values[3] ?? studio.published_version;
          studio.last_published_at = new Date();
        }
        return result([]);
      }

      if (sql.startsWith('insert into chatbot_import_proposals')) {
        const row = {
          id: values[0],
          organization_id: values[1],
          site_id: values[2],
          file_name: values[3],
          file_type: values[4],
          extracted_questions: values[5],
          extracted_links: values[6],
          proposed_knowledge: JSON.parse(String(values[7])),
          status: 'pending'
        };
        proposals.set(String(row.id), row);
        return result<T>([row]);
      }

      if (sql.startsWith('select * from chatbot_import_proposals')) {
        return result<T>([...proposals.values()].filter((proposal) => proposal.id === values[0]));
      }

      if (sql.startsWith('update chatbot_import_proposals')) {
        const proposal = proposals.get(String(values[0]));
        if (proposal) proposal.status = 'accepted';
        return result<T>(proposal ? [proposal] : []);
      }

      if (sql.startsWith('insert into chatbot_simulations')) return result([]);

      if (sql.startsWith('update knowledge_items')) {
        knowledgeItems.forEach((item) => {
          if (item.status === 'draft') item.status = 'active';
        });
        return result([]);
      }

      if (sql.startsWith('update chatbot_studio_versions')) {
        const row = versions.find((version) => version.version_number === values[2]);
        if (row) row.status = 'published';
        return result<T>(row ? [row] : []);
      }

      if (sql.startsWith('select * from chatbot_studio_versions')) return result<T>(versions);

      if (sql.startsWith('select count(*) filter')) {
        return result<T>([
          {
            draft_items: knowledgeItems.filter((item) => item.status === 'draft').length,
            published_items: knowledgeItems.filter((item) => item.status === 'active').length,
            needs_review: 0,
            archived_items: 0
          }
        ]);
      }

      return result([]);
    }
  };
}

function result<T extends pg.QueryResultRow = pg.QueryResultRow>(
  rows: Array<Record<string, unknown>>
): pg.QueryResult<T> {
  return {
    rows: rows as T[],
    command: '',
    rowCount: rows.length,
    oid: 0,
    fields: []
  };
}
