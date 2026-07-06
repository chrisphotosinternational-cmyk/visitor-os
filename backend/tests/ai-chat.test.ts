import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import type pg from 'pg';
import type { Database } from '../src/database/client.js';
import { AIChatService } from '../src/modules/ai-chat/ai-chat-service.js';

const ORG_A = '00000000-0000-4000-8000-0000000000a1';
const USER_A = '00000000-0000-4000-8000-0000000000f1';
const SESSION_A = '00000000-0000-4000-8000-00000000c001';

describe('AI CRM chatbot', () => {
  it('answers top prospect questions with citations and CSV export data', async () => {
    const database = fakeChatDatabase();
    const chat = new AIChatService(database);
    const answer = await chat.sendMessage({
      sessionId: SESSION_A,
      organizationId: ORG_A,
      userId: USER_A,
      content: "Quels sont les 20 meilleurs prospects à contacter aujourd'hui ?"
    });

    assert.ok(answer);
    assert.equal(answer.answer.intent, 'top_action_list');
    assert.equal(answer.answer.prospects.length, 2);
    assert.equal(answer.answer.citations[0]?.prospect, 'Emma Studio');
    assert.match(answer.answer.csv, /Emma Studio/);
    assert.equal(answer.answer.refused, false);
  });

  it('summarizes pipeline state without modifying CRM data', async () => {
    const chat = new AIChatService(fakeChatDatabase());
    const answer = await chat.sendMessage({
      sessionId: SESSION_A,
      organizationId: ORG_A,
      userId: USER_A,
      content: "Résume-moi l'état du pipeline."
    });

    assert.ok(answer);
    assert.equal(answer.answer.intent, 'pipeline_summary');
    assert.match(answer.answer.content, /interested/);
    assert.equal(answer.answer.prospects.length, 0);
  });

  it('refuses unauthorized mutation requests', async () => {
    const chat = new AIChatService(fakeChatDatabase());
    const answer = await chat.sendMessage({
      sessionId: SESSION_A,
      organizationId: ORG_A,
      userId: USER_A,
      content: 'Supprime tous les prospects refusés.'
    });

    assert.ok(answer);
    assert.equal(answer.answer.intent, 'refused_mutation');
    assert.equal(answer.answer.refused, true);
    assert.match(answer.answer.content, /je ne peux pas modifier/i);
  });

  it('keeps all CRM reads scoped to the requested organization', async () => {
    const database = fakeChatDatabase();
    const chat = new AIChatService(database);
    await chat.sendMessage({
      sessionId: SESSION_A,
      organizationId: ORG_A,
      userId: USER_A,
      content: 'Quels prospects ont un score supérieur à 80 ?'
    });

    const prospectQueries = database.calls.filter((call) => call.text.includes('from prospects p'));
    assert.ok(prospectQueries.length > 0);
    assert.ok(prospectQueries.every((call) => call.values[0] === ORG_A));
  });
});

function fakeChatDatabase(): Database & { calls: Array<{ text: string; values: unknown[] }> } {
  const session = {
    id: SESSION_A,
    organization_id: ORG_A,
    user_id: USER_A,
    title: 'Assistant CRM',
    created_at: new Date('2026-07-06T08:00:00Z'),
    updated_at: new Date('2026-07-06T08:00:00Z')
  };
  const calls: Array<{ text: string; values: unknown[] }> = [];

  return {
    calls,
    isConfigured: () => true,
    checkConnection: () => Promise.resolve(),
    close: () => Promise.resolve(),
    async query<T extends pg.QueryResultRow = pg.QueryResultRow>(
      text: string,
      values: unknown[] = []
    ): Promise<pg.QueryResult<T>> {
      calls.push({ text, values });
      const normalized = text.replace(/\s+/g, ' ').trim().toLowerCase();

      if (normalized.startsWith('select * from ai_chat_sessions where id')) {
        return result([session] as unknown as T[]);
      }

      if (normalized.startsWith('insert into ai_chat_sessions')) {
        return result([
          { ...session, id: values[0] as string, title: values[3] as string }
        ] as unknown as T[]);
      }

      if (normalized.startsWith('insert into ai_chat_messages')) {
        return result([
          {
            id: values[0],
            session_id: values[1],
            organization_id: values[2],
            user_id: values[3],
            role: values[4],
            content: values[5],
            intent: values[6],
            citations: typeof values[7] === 'string' ? JSON.parse(values[7]) : [],
            result_csv: values[8],
            created_at: new Date('2026-07-06T08:01:00Z')
          }
        ] as unknown as T[]);
      }

      if (normalized.startsWith('update ai_chat_sessions')) return result([] as unknown as T[]);
      if (normalized.startsWith('insert into crm_activity_log'))
        return result([] as unknown as T[]);

      if (normalized.includes('group by status')) {
        return result([
          { status: 'interested', count: '4', average_score: '82.2' },
          { status: 'to_contact', count: '8', average_score: '74.6' }
        ] as unknown as T[]);
      }

      if (normalized.includes('from prospect_ai_analysis')) {
        return result([
          {
            prospect_id: '00000000-0000-4000-8000-00000000aa01',
            summary: 'Profil prioritaire',
            recommended_offer: 'Shooting premium',
            priority: 'very_high',
            confidence: 91
          }
        ] as unknown as T[]);
      }

      if (normalized.includes('from prospects p')) {
        return result([
          prospectRow(
            '00000000-0000-4000-8000-00000000aa01',
            'Emma Studio',
            95,
            'Albi',
            'interested'
          ),
          prospectRow(
            '00000000-0000-4000-8000-00000000aa02',
            'Lina Content',
            86,
            'Toulouse',
            'to_contact'
          )
        ] as unknown as T[]);
      }

      return result([] as unknown as T[]);
    }
  };
}

function prospectRow(id: string, displayName: string, score: number, city: string, status: string) {
  return {
    id,
    display_name: displayName,
    score,
    score_label: score >= 90 ? 'very_high' : 'high',
    status,
    city,
    email: `${displayName.toLowerCase().replaceAll(' ', '.')}@example.com`,
    phone: '+33600000000',
    instagram: '@profile',
    twitter_x: null,
    mym: displayName.includes('Lina') ? 'lina-mym' : null,
    onlyfans: null,
    website: null,
    linktree: null,
    allmylinks: null,
    last_action: 'Relancer avec proposition courte',
    follow_up_date: null
  };
}

function result<T extends pg.QueryResultRow>(rows: T[]): pg.QueryResult<T> {
  return {
    command: 'SELECT',
    rowCount: rows.length,
    oid: 0,
    fields: [],
    rows
  };
}
