import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { describe, it } from 'node:test';
import { createApp } from '../src/app.js';
import { loadConfig } from '../src/core/config/env.js';
import { createLogger } from '../src/core/logger/logger.js';
import type { Database } from '../src/database/client.js';
import { hashPassword } from '../src/modules/auth/password.js';
import type pg from 'pg';

describe('visitor to admin flow', () => {
  it('records a widget conversation and exposes the prospect in admin', async () => {
    const database = await createMemoryDatabase();
    const app = await createApp({
      config: loadConfig({
        NODE_ENV: 'test',
        LOG_LEVEL: 'silent',
        DATABASE_URL: 'postgresql://visitor_os:visitor_os@localhost:5432/visitor_os'
      }),
      database,
      logger: createLogger()
    });

    const startResponse = await app.inject({
      method: 'POST',
      url: '/api/widget/conversations',
      payload: {
        siteKey: 'demo-site-key',
        anonymousId: 'visitor-1',
        pageUrl: 'https://example.com'
      }
    });
    assert.equal(startResponse.statusCode, 200);
    const started = startResponse.json() as { conversationId: string };

    const messageResponse = await app.inject({
      method: 'POST',
      url: `/api/widget/conversations/${started.conversationId}/messages`,
      payload: {
        content: 'Bonjour, quels sont vos tarifs et disponibilites ?'
      }
    });
    assert.equal(messageResponse.statusCode, 200);
    const message = messageResponse.json() as {
      prospectId: string;
      reply: string;
      source: string;
      shouldEscalate: boolean;
    };
    assert.ok(message.prospectId);
    assert.equal(message.source, 'human_escalation');
    assert.equal(message.shouldEscalate, true);
    assert.match(message.reply, /information approximative/i);

    const loginResponse = await app.inject({
      method: 'POST',
      url: '/api/admin/auth/login',
      payload: {
        email: 'admin@example.com',
        password: 'test-password-123'
      }
    });
    assert.equal(loginResponse.statusCode, 200);
    const cookie = loginResponse.headers['set-cookie'];
    assert.ok(cookie);

    const prospectsResponse = await app.inject({
      method: 'GET',
      url: '/api/admin/prospects',
      headers: { cookie }
    });
    assert.equal(prospectsResponse.statusCode, 200);
    const prospectsList = prospectsResponse.json() as { prospects: Array<{ id: string }> };
    assert.equal(prospectsList.prospects.length, 1);

    const conversationsResponse = await app.inject({
      method: 'GET',
      url: '/api/admin/conversations?search=tarifs',
      headers: { cookie }
    });
    assert.equal(conversationsResponse.statusCode, 200);
    const conversationsList = conversationsResponse.json() as {
      conversations: Array<{ id: string; status: string; last_message: string }>;
    };
    assert.equal(conversationsList.conversations.length, 1);
    assert.equal(conversationsList.conversations[0]?.id, started.conversationId);

    const detailResponse = await app.inject({
      method: 'GET',
      url: `/api/admin/prospects/${message.prospectId}`,
      headers: { cookie }
    });
    assert.equal(detailResponse.statusCode, 200);
    const detail = detailResponse.json() as {
      prospect: { conversations: Array<{ messages: Array<{ content: string }> }> };
    };
    assert.equal(detail.prospect.conversations[0]?.messages.length, 3);

    const conversationDetailResponse = await app.inject({
      method: 'GET',
      url: `/api/admin/conversations/${started.conversationId}`,
      headers: { cookie }
    });
    assert.equal(conversationDetailResponse.statusCode, 200);
    const conversationDetail = conversationDetailResponse.json() as {
      conversation: {
        messages: Array<{ content: string; response_source: string | null }>;
        status: string;
      };
    };
    assert.equal(conversationDetail.conversation.messages.length, 3);
    assert.equal(conversationDetail.conversation.status, 'open');
    assert.equal(conversationDetail.conversation.messages[2]?.response_source, 'human_escalation');

    const statusResponse = await app.inject({
      method: 'PATCH',
      url: `/api/admin/prospects/${message.prospectId}/status`,
      headers: { cookie },
      payload: {
        status: 'A rappeler'
      }
    });
    assert.equal(statusResponse.statusCode, 200);
    assert.equal(
      (statusResponse.json() as { prospect: { status: string } }).prospect.status,
      'A rappeler'
    );

    const conversationStatusResponse = await app.inject({
      method: 'PATCH',
      url: `/api/admin/conversations/${started.conversationId}/status`,
      headers: { cookie },
      payload: {
        status: 'qualified'
      }
    });
    assert.equal(conversationStatusResponse.statusCode, 200);
    assert.equal(
      (conversationStatusResponse.json() as { conversation: { status: string } }).conversation
        .status,
      'qualified'
    );

    await app.close();
  });
});

async function createMemoryDatabase(): Promise<Database> {
  const site = {
    id: '00000000-0000-4000-8000-000000000101',
    organization_id: '00000000-0000-4000-8000-000000000001',
    name: 'Site demo',
    slug: 'demo-site',
    widget_public_key: 'demo-site-key',
    activity: 'default',
    business_config_id: 'default',
    status: 'active',
    widget_enabled: true
  };
  const visitors = new Map<string, { id: string; anonymous_id: string }>();
  const conversations = new Map<string, Record<string, unknown>>();
  const prospects = new Map<string, Record<string, unknown>>();
  const messages = new Map<string, Array<Record<string, unknown>>>();
  const users = new Map<string, Record<string, unknown>>();
  const sessions = new Map<string, Record<string, unknown>>();
  const user = {
    id: '00000000-0000-4000-8000-000000000901',
    organization_id: '00000000-0000-4000-8000-000000000001',
    first_name: 'Admin',
    last_name: 'Test',
    email: 'admin@example.com',
    password_hash: await hashPassword('test-password-123'),
    role: 'SuperAdmin',
    status: 'active',
    created_at: new Date(),
    updated_at: new Date()
  };
  users.set(String(user.id), user);

  return {
    isConfigured: () => true,
    async checkConnection() {},
    async close() {},
    async query<T extends pg.QueryResultRow = pg.QueryResultRow>(
      text: string,
      values: unknown[] = []
    ): Promise<pg.QueryResult<T>> {
      const sql = text.toLowerCase();

      if (sql.includes('from sites where widget_public_key')) {
        return result([site]);
      }

      if (sql.includes('from users where lower(email)')) {
        return result(
          [...users.values()].filter(
            (row) => String(row.email).toLowerCase() === String(values[0]).toLowerCase()
          )
        );
      }

      if (sql.includes('from users where id')) {
        return result(optional(users.get(String(values[0]))));
      }

      if (sql.includes('insert into admin_sessions')) {
        const row = {
          id: values[0],
          user_id: values[1],
          organization_id: values[2],
          token_hash: values[3],
          expires_at: values[4],
          created_at: new Date(),
          renewed_at: new Date(),
          revoked_at: null
        };
        sessions.set(String(row.token_hash), row);
        return result([row]);
      }

      if (sql.includes('from admin_sessions')) {
        const session = sessions.get(String(values[0]));
        if (!session || session.revoked_at) return result([]);

        return result([session]);
      }

      if (sql.includes('update admin_sessions set revoked_at')) {
        const session = sessions.get(String(values[0]));
        if (session) session.revoked_at = new Date();
        return result([]);
      }

      if (sql.includes('update admin_sessions set expires_at')) {
        const session = [...sessions.values()].find((row) => row.id === values[1]);
        if (session) {
          session.expires_at = values[0];
          session.renewed_at = new Date();
        }
        return result([]);
      }

      if (sql.includes('from sites where id')) {
        return result(String(values[0]) === site.id ? [site] : []);
      }

      if (sql.includes('insert into visitors')) {
        const id = String(values[0]);
        const anonymousId = String(values[3]);
        const existing = visitors.get(anonymousId);
        if (existing) return result([{ id: existing.id }]);
        visitors.set(anonymousId, { id, anonymous_id: anonymousId });
        return result([{ id }]);
      }

      if (sql.includes('insert into conversations')) {
        const row = {
          id: values[0],
          organization_id: values[1],
          site_id: values[2],
          visitor_id: values[3],
          prospect_id: null,
          status: 'open',
          page_url: values[4] ?? null,
          referrer: values[5] ?? null,
          created_at: new Date(),
          updated_at: new Date()
        };
        conversations.set(String(row.id), row);
        return result([row]);
      }

      if (sql.includes('from conversations where id')) {
        return result(optional(conversations.get(String(values[0]))));
      }

      if (sql.includes('insert into messages')) {
        const row = {
          id: values[0],
          organization_id: values[1],
          conversation_id: values[2],
          sender_type: values[3],
          content: values[4],
          response_source: values[5] ?? null,
          response_confidence: values[6] ?? null,
          should_escalate: values[7] ?? null,
          processing_time_ms: values[8] ?? null,
          matched_item_id: values[9] ?? null,
          decision_reason: values[10] ?? null,
          created_at: new Date()
        };
        const conversationMessages = messages.get(String(row.conversation_id)) ?? [];
        conversationMessages.push(row);
        messages.set(String(row.conversation_id), conversationMessages);
        return result([row]);
      }

      if (sql.includes('insert into decision_events')) {
        return result([]);
      }

      if (sql.includes('insert into ai_events')) {
        return result([]);
      }

      if (sql.includes('from ai_configurations')) {
        return result([]);
      }

      if (sql.includes('from site_qa_items')) {
        return result([]);
      }

      if (sql.includes('from knowledge_items k')) {
        return result([]);
      }

      if (sql.includes('insert into chatbot_unanswered_questions')) {
        return result([
          {
            id: values[0],
            organization_id: values[1],
            site_id: values[2],
            conversation_id: values[3],
            question: values[4],
            status: 'pending',
            suggested_answer: null,
            category: null,
            tags: [],
            created_at: new Date(),
            updated_at: new Date()
          }
        ]);
      }

      if (sql.includes('insert into prospects')) {
        const row = {
          id: values[0],
          organization_id: values[1],
          site_id: values[2],
          visitor_id: values[3],
          display_name: values[4],
          email: null,
          phone: null,
          status: values[5],
          temperature: values[6],
          score_current: values[7],
          source: 'widget',
          created_at: new Date(),
          updated_at: new Date()
        };
        prospects.set(String(row.id), row);
        return result([row]);
      }

      if (sql.includes('update conversations set prospect_id')) {
        const conversation = conversations.get(String(values[1]));
        if (conversation) conversation.prospect_id = values[0];
        return result([]);
      }

      if (sql.includes('update conversations set status')) {
        const conversation = conversations.get(String(values[1]));
        if (conversation) {
          conversation.status = values[0];
          conversation.updated_at = new Date();
        }
        return result([]);
      }

      if (sql.includes('from conversations c') && sql.includes('where c.id = $1')) {
        const conversation = conversations.get(String(values[0]));
        if (!conversation) return result([]);
        const prospect = prospects.get(String(conversation.prospect_id));
        const conversationMessages = messages.get(String(conversation.id)) ?? [];
        const lastMessage = conversationMessages.at(-1);

        return result([
          {
            id: conversation.id,
            status: conversation.status,
            created_at: conversation.created_at,
            updated_at: conversation.updated_at,
            page_url: conversation.page_url,
            prospect_id: conversation.prospect_id,
            display_name: prospect?.display_name ?? null,
            prospect_status: prospect?.status ?? null,
            last_message: lastMessage?.content ?? null
          }
        ]);
      }

      if (sql.includes('from conversations c') && sql.includes('left join prospects')) {
        const search =
          typeof values[0] === 'string' ? values[0].replaceAll('%', '').toLowerCase() : '';
        const rows = [...conversations.values()]
          .map((conversation) => {
            const prospect = prospects.get(String(conversation.prospect_id));
            const conversationMessages = messages.get(String(conversation.id)) ?? [];
            const lastMessage = conversationMessages.at(-1);

            return {
              id: conversation.id,
              status: conversation.status,
              created_at: conversation.created_at,
              updated_at: conversation.updated_at,
              page_url: conversation.page_url,
              prospect_id: conversation.prospect_id,
              display_name: prospect?.display_name ?? null,
              prospect_status: prospect?.status ?? null,
              last_message: lastMessage?.content ?? null
            };
          })
          .filter((conversation) => {
            if (!search) return true;

            return (
              toSearchText(conversation.display_name).includes(search) ||
              toSearchText(conversation.last_message).includes(search)
            );
          });

        return result(rows);
      }

      if (sql.includes('select * from prospects order by')) {
        return result([...prospects.values()]);
      }

      if (sql.includes('select * from prospects where id')) {
        return result(optional(prospects.get(String(values[0]))));
      }

      if (sql.includes('from conversations where prospect_id')) {
        return result(
          [...conversations.values()].filter(
            (conversation) => conversation.prospect_id === values[0]
          )
        );
      }

      if (sql.includes('from messages')) {
        return result(messages.get(String(values[0])) ?? []);
      }

      if (sql.includes('update prospects set status')) {
        const prospect = prospects.get(String(values[1]));
        if (!prospect) return result([]);
        prospect.status = values[0];
        prospect.updated_at = new Date();
        return result([prospect]);
      }

      return result([{ id: randomUUID() }]);
    }
  };
}

function optional<T>(value: T | undefined): T[] {
  return value ? [value] : [];
}

function toSearchText(value: unknown): string {
  return typeof value === 'string' ? value.toLowerCase() : '';
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
