import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import type pg from 'pg';
import type { Database } from '../src/database/client.js';
import type {
  ConversationRecord,
  SiteRecord
} from '../src/modules/conversations/conversation-repository.js';
import { ChatbotProductionService } from '../src/modules/chatbot-production/chatbot-production-service.js';

const ORG_A = '00000000-0000-4000-8000-0000000000a1';
const SITE_A = '00000000-0000-4000-8000-000000000101';
const CONVERSATION_A = '00000000-0000-4000-8000-00000000c101';
const VISITOR_A = '00000000-0000-4000-8000-00000000v101';
const PROSPECT_A = '00000000-0000-4000-8000-00000000p101';
const UNANSWERED_A = '00000000-0000-4000-8000-00000000u101';

describe('Chatbot production hardening', () => {
  it('accepts authorized widget domains and rejects unknown domains', () => {
    const production = new ChatbotProductionService(fakeProductionDatabase());

    production.assertDomainAllowed(
      { allowed_domains: ['chambres-dhotes-albi.com'] },
      'https://www.chambres-dhotes-albi.com/sejour'
    );

    assert.throws(
      () =>
        production.assertDomainAllowed(
          { allowed_domains: ['chambres-dhotes-albi.com'] },
          'https://evil.example/widget'
        ),
      /Widget domain is not allowed/
    );
  });

  it('imports site Q/A CSV rows and answers from indexed site knowledge', async () => {
    const database = fakeProductionDatabase();
    const production = new ChatbotProductionService(database);

    const imported = await production.importQaCsv({
      organizationId: ORG_A,
      siteId: SITE_A,
      siteDomain: 'chambres-dhotes-albi.com',
      csv: [
        'site_domain,category,question,answer,tags,priority,is_active',
        'chambres-dhotes-albi.com,parking,Avez-vous un parking ?,Oui parking gratuit,parking|acces,90,true',
        'autre-site.fr,tarifs,Question ignoree,Reponse ignoree,tarif,50,true'
      ].join('\n')
    });

    const answer = await production.findQaAnswer({
      organizationId: ORG_A,
      siteId: SITE_A,
      question: 'Avez-vous un parking ?'
    });

    assert.equal(imported.rows, 2);
    assert.equal(imported.imported, 1);
    assert.equal(imported.skipped, 1);
    assert.equal(answer?.answer, 'Oui parking gratuit');
  });

  it('converts an unanswered question into a reusable site Q/A item', async () => {
    const database = fakeProductionDatabase();
    const production = new ChatbotProductionService(database);

    await production.recordUnanswered({
      organizationId: ORG_A,
      siteId: SITE_A,
      conversationId: CONVERSATION_A,
      question: 'Acceptez-vous les arrivees tardives ?'
    });

    const converted = await production.convertUnansweredToQa({
      organizationId: ORG_A,
      siteId: SITE_A,
      unansweredId: UNANSWERED_A,
      answer: 'Oui, sur demande avant votre arrivee.',
      category: 'arrival',
      tags: ['arrivee', 'horaires']
    });

    assert.equal(converted.unanswered.status, 'converted');
    assert.equal(converted.qa.category, 'arrival');
    assert.equal(converted.qa.answer, 'Oui, sur demande avant votre arrivee.');
  });

  it('captures a chatbot lead without duplicating an existing CRM prospect', async () => {
    const database = fakeProductionDatabase({ existingProspect: true });
    const production = new ChatbotProductionService(database);
    const site = siteRecord();
    const conversation = conversationRecord();

    const captured = await production.captureLead({
      site,
      conversation,
      payload: {
        name: 'Emma',
        email: 'emma@example.com',
        phone: '+33 6 12 34 56 78',
        need: 'Reservation week-end'
      }
    });

    assert.equal(captured.prospectId, PROSPECT_A);
    assert.equal(captured.deduplicated, true);
    assert.equal(database.createdProspects, 0);
    assert.match(database.updatedProspectNotes[0] ?? '', /Lead capturé via chatbot/);
  });

  it('returns chatbot dashboard metrics scoped to the organization', async () => {
    const production = new ChatbotProductionService(fakeProductionDatabase());
    const metrics = await production.metrics(ORG_A);

    assert.equal(metrics.conversationsBySite[0]?.site, 'Demo Site');
    assert.equal(metrics.fallbackRate, 0.25);
    assert.equal(metrics.unansweredQuestions, 3);
    assert.equal(metrics.leadsCaptured, 5);
    assert.equal(metrics.conversionRate, 0.5);
    assert.equal(metrics.topCategories[0]?.category, 'parking');
  });
});

function fakeProductionDatabase(options?: { existingProspect?: boolean }): Database & {
  createdProspects: number;
  updatedProspectNotes: string[];
} {
  const qaItems: Array<Record<string, unknown>> = [];
  const unanswered: Array<Record<string, unknown>> = [
    {
      id: UNANSWERED_A,
      organization_id: ORG_A,
      site_id: SITE_A,
      conversation_id: CONVERSATION_A,
      question: 'Acceptez-vous les arrivees tardives ?',
      status: 'pending',
      suggested_answer: null,
      category: null,
      tags: [],
      created_at: new Date('2026-07-06T08:00:00Z'),
      updated_at: new Date('2026-07-06T08:00:00Z')
    }
  ];
  const database = {
    createdProspects: 0,
    updatedProspectNotes: [] as string[],
    isConfigured: () => true,
    checkConnection: () => Promise.resolve(),
    close: () => Promise.resolve(),
    async query<T extends pg.QueryResultRow = pg.QueryResultRow>(
      text: string,
      values: unknown[] = []
    ): Promise<pg.QueryResult<T>> {
      const normalized = text.replace(/\s+/g, ' ').trim().toLowerCase();

      if (normalized.startsWith('insert into site_qa_items')) {
        const row = {
          id: values[0],
          organization_id: values[1],
          site_id: values[2],
          category: values[3],
          question: values[4],
          answer: values[5],
          tags: values[6],
          priority: values[7],
          is_active: values[8],
          created_at: new Date('2026-07-06T08:01:00Z'),
          updated_at: new Date('2026-07-06T08:01:00Z')
        };
        qaItems.push(row);
        return result(asRows<T>([row]));
      }

      if (normalized.includes('from site_qa_items') && normalized.includes('lower(question)')) {
        return result(
          asRows<T>(
            qaItems.filter((item) => item.question === values[2] && item.site_id === values[1])
          )
        );
      }

      if (normalized.startsWith('insert into chatbot_unanswered_questions')) {
        return result(asRows<T>([unanswered[0]]));
      }

      if (normalized.startsWith('select * from chatbot_unanswered_questions')) {
        return result(asRows<T>(unanswered.filter((item) => item.id === values[0])));
      }

      if (normalized.startsWith('update chatbot_unanswered_questions')) {
        const item = unanswered[0];
        const updated = {
          ...item,
          status: 'converted',
          suggested_answer: values[0],
          category: values[1],
          tags: values[2],
          updated_at: new Date('2026-07-06T08:02:00Z')
        };
        unanswered[0] = updated;
        return result(asRows<T>([updated]));
      }

      if (normalized.startsWith('select id from prospects')) {
        return result(asRows<T>(options?.existingProspect ? [{ id: PROSPECT_A }] : []));
      }

      if (normalized.startsWith('update prospects')) {
        database.updatedProspectNotes.push(typeof values[4] === 'string' ? values[4] : '');
        return result(asRows<T>([]));
      }

      if (normalized.startsWith('insert into prospects')) {
        database.createdProspects += 1;
        return result(asRows<T>([]));
      }

      if (normalized.startsWith('update conversations')) {
        return result(asRows<T>([]));
      }

      if (normalized.startsWith('select s.id as site_id')) {
        return result(asRows<T>([{ site_id: SITE_A, site: 'Demo Site', conversations: '10' }]));
      }

      if (normalized.includes("count(*) filter (where source in ('fallback'")) {
        return result(asRows<T>([{ total: '8', fallback: '2' }]));
      }

      if (
        normalized.includes('from chatbot_unanswered_questions') &&
        normalized.includes("status = 'pending'")
      ) {
        return result(asRows<T>([{ count: '3' }]));
      }

      if (normalized.includes('count(distinct p.id)::text as leads')) {
        return result(asRows<T>([{ leads: '5', conversations: '10' }]));
      }

      if (normalized.startsWith('select question, count(*)::text as count')) {
        return result(asRows<T>([{ question: 'Avez-vous un parking ?', count: '4' }]));
      }

      if (normalized.startsWith('select category, count(*)::text as count')) {
        return result(asRows<T>([{ category: 'parking', count: '4' }]));
      }

      return result(asRows<T>([]));
    }
  };

  return database;
}

function siteRecord(): SiteRecord {
  return {
    id: SITE_A,
    organization_id: ORG_A,
    name: 'Demo Site',
    slug: 'demo-site',
    domain: 'chambres-dhotes-albi.com',
    widget_public_key: 'demo-site-key',
    activity: 'hospitality',
    business_config_id: 'config-site-a',
    status: 'active',
    widget_enabled: true,
    allowed_domains: ['chambres-dhotes-albi.com'],
    widget_primary_color: '#1f6f5b',
    widget_welcome_message: 'Bonjour',
    widget_fallback_message: 'Contactez-nous.',
    widget_privacy_message: 'Confidentialite',
    lead_capture_enabled: true,
    lead_capture_trigger: 'after_messages',
    lead_capture_after_messages: 3,
    lead_capture_fields: ['name', 'email', 'phone', 'need']
  };
}

function conversationRecord(): ConversationRecord {
  return {
    id: CONVERSATION_A,
    organization_id: ORG_A,
    site_id: SITE_A,
    visitor_id: VISITOR_A,
    prospect_id: null,
    status: 'open',
    page_url: 'https://chambres-dhotes-albi.com/',
    referrer: null,
    created_at: new Date('2026-07-06T08:00:00Z'),
    updated_at: new Date('2026-07-06T08:00:00Z')
  };
}

function result<T extends pg.QueryResultRow>(rows: T[]): pg.QueryResult<T> {
  return {
    rows,
    command: 'SELECT',
    rowCount: rows.length,
    oid: 0,
    fields: []
  };
}

function asRows<T extends pg.QueryResultRow>(rows: unknown[]): T[] {
  return rows as T[];
}
