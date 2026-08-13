import { createHash } from 'node:crypto';

export const ALLOW_FLAG = 'CHATBOT_SMOKE_ALLOW_PERSISTENT_FIXTURES';
export const SMOKE_ORGANIZATIONS = [
  {
    id: '5a000000-0000-4000-8000-000000000001',
    name: 'VISITOR-OS Smoke Org A',
    slug: 'visitor-os-smoke-org-a'
  },
  {
    id: '5a000000-0000-4000-8000-000000000002',
    name: 'VISITOR-OS Smoke Org B',
    slug: 'visitor-os-smoke-org-b'
  }
];

const origin = (port) => `http://127.0.0.1:${port}`;
export const SMOKE_SITES = [
  {
    id: '5a100000-0000-4000-8000-000000000001',
    organizationId: SMOKE_ORGANIZATIONS[0].id,
    name: 'Smoke Site A1',
    slug: 'smoke-site-a1',
    key: 'vos_smoke_a1_5a100001',
    origin: origin(3101),
    title: 'Smoke A1 public runtime facts',
    content: `La réponse simple demandée est SMOKE-A1-SIMPLE-ORCHID.
Le tarif synthétique commence à SMOKE-A1-PRICE-START-420, dure SMOKE-A1-PRICE-DURATION-3H et la livraison coûte SMOKE-A1-PRICE-DELIVERY-200.
Les informations pratiques sont SMOKE-A1-MULTI-CHECKIN-17H, SMOKE-A1-MULTI-PARKING-VIOLET et SMOKE-A1-MULTI-BREAKFAST-07H30.
Le marqueur propre à ce site est SMOKE-SITE-A1-MARKER-ORCHID. Le marqueur de son organisation est SMOKE-ORG-A-MARKER-COPPER.`
  },
  {
    id: '5a100000-0000-4000-8000-000000000002',
    organizationId: SMOKE_ORGANIZATIONS[0].id,
    name: 'Smoke Site A2',
    slug: 'smoke-site-a2',
    key: 'vos_smoke_a2_5a100002',
    origin: origin(3102),
    title: 'Smoke A2 isolation facts',
    content:
      'Le marqueur propre à ce site est SMOKE-SITE-A2-MARKER-SAFFRON. Le marqueur de son organisation est SMOKE-ORG-A-MARKER-COPPER.'
  },
  {
    id: '5a100000-0000-4000-8000-000000000003',
    organizationId: SMOKE_ORGANIZATIONS[1].id,
    name: 'Smoke Site B1',
    slug: 'smoke-site-b1',
    key: 'vos_smoke_b1_5a100003',
    origin: origin(3103),
    title: 'Smoke B1 isolation facts',
    content:
      'Le marqueur propre à ce site est SMOKE-SITE-B1-MARKER-INDIGO. Le marqueur de son organisation est SMOKE-ORG-B-MARKER-SILVER.'
  }
];

export function assertPersistentFixtureGuard(environment) {
  if (environment[ALLOW_FLAG] !== 'true') {
    throw new Error(`${ALLOW_FLAG}=true is required (STAGING-ONLY persistent fixtures)`);
  }
  const databaseUrl = environment.DATABASE_URL?.trim();
  if (!databaseUrl) throw new Error('DATABASE_URL is required');
  let parsed;
  try {
    parsed = new URL(databaseUrl);
  } catch {
    throw new Error('DATABASE_URL must be a valid PostgreSQL URL');
  }
  if (!['postgres:', 'postgresql:'].includes(parsed.protocol) || !parsed.hostname) {
    throw new Error('DATABASE_URL must be a valid PostgreSQL URL');
  }
}

const documentId = (index) => `5a200000-0000-4000-8000-00000000000${index + 1}`;
const itemId = (index) => `5a300000-0000-4000-8000-00000000000${index + 1}`;

export async function seedFixtures(client) {
  await assertReservedIdentitiesAvailable(client);
  for (const organization of SMOKE_ORGANIZATIONS) {
    await client.query(
      `insert into organizations (id, name, slug, status)
      values ($1, $2, $3, 'active') on conflict (id) do update set name=excluded.name, slug=excluded.slug, status='active'`,
      [organization.id, organization.name, organization.slug]
    );
  }
  for (const [index, site] of SMOKE_SITES.entries()) {
    await client.query(
      `insert into sites
      (id, organization_id, name, slug, domain, widget_public_key, activity, status, widget_enabled, allowed_domains)
      values ($1,$2,$3,$4,'localhost',$5,'chatbot-smoke-fixture','active',true,$6)
      on conflict (id) do update set organization_id=excluded.organization_id,name=excluded.name,slug=excluded.slug,
      domain=excluded.domain,widget_public_key=excluded.widget_public_key,activity=excluded.activity,status='active',
      widget_enabled=true,allowed_domains=excluded.allowed_domains`,
      [site.id, site.organizationId, site.name, site.slug, site.key, [site.origin]]
    );
    const hash = createHash('sha256').update(site.content).digest('hex');
    await client.query(
      `insert into knowledge_documents
      (id,organization_id,site_id,title,description,category,type,language,version,size_bytes,hash,status,tags,author,source)
      values ($1,$2,$3,$4,'Fixture réservée au smoke public','smoke','text','fr',1,$5,$6,'active',$7,'visitor-os-smoke','chatbot-smoke-staging')
      on conflict (id) do update set organization_id=excluded.organization_id,site_id=excluded.site_id,title=excluded.title,
      size_bytes=excluded.size_bytes,hash=excluded.hash,status='active',tags=excluded.tags,updated_at=now()`,
      [
        documentId(index),
        site.organizationId,
        site.id,
        site.title,
        Buffer.byteLength(site.content),
        hash,
        ['chatbot-smoke-staging', site.slug]
      ]
    );
    await client.query('delete from knowledge_chunks where document_id=$1', [documentId(index)]);
    await client.query(
      `insert into knowledge_chunks (id,document_id,organization_id,site_id,content,position,tokens,metadata)
      values ($1,$2,$3,$4,$5,0,$6,$7::jsonb)`,
      [
        `chatbot-smoke-${site.slug}-chunk`,
        documentId(index),
        site.organizationId,
        site.id,
        site.content,
        site.content.toLowerCase().match(/[a-z0-9À-ÿ_-]+/g) ?? [],
        JSON.stringify({ fixture: 'chatbot-smoke-staging' })
      ]
    );
    await client.query(
      `insert into knowledge_items
      (id,organization_id,site_id,title,main_question,alternative_questions,short_answer,detailed_answer,tags,priority,status,version)
      values ($1,$2,$3,$4,$5,$6,$7,$7,$8,100,'published',1)
      on conflict (id) do update set title=excluded.title,main_question=excluded.main_question,
      alternative_questions=excluded.alternative_questions,short_answer=excluded.short_answer,detailed_answer=excluded.detailed_answer,
      tags=excluded.tags,priority=100,status='published',updated_at=now()`,
      [
        itemId(index),
        site.organizationId,
        site.id,
        site.title,
        'Quelles sont les informations smoke de ce site ?',
        ['Quel est le marqueur de ce site ?', 'Quel est le marqueur de cette organisation ?'],
        site.content,
        ['chatbot-smoke-staging', site.slug]
      ]
    );
  }
}

async function assertReservedIdentitiesAvailable(client) {
  const organizations = await client.query(
    `select id::text, slug from organizations where id = any($1) or slug = any($2)`,
    [SMOKE_ORGANIZATIONS.map(({ id }) => id), SMOKE_ORGANIZATIONS.map(({ slug }) => slug)]
  );
  for (const row of organizations.rows) {
    if (!SMOKE_ORGANIZATIONS.some(({ id, slug }) => id === row.id && slug === row.slug)) {
      throw new Error(`Reserved smoke organization identity collision: ${row.id}/${row.slug}`);
    }
  }

  const sites = await client.query(
    `select id::text, slug, widget_public_key from sites
      where id = any($1) or slug = any($2) or widget_public_key = any($3)`,
    [
      SMOKE_SITES.map(({ id }) => id),
      SMOKE_SITES.map(({ slug }) => slug),
      SMOKE_SITES.map(({ key }) => key)
    ]
  );
  for (const row of sites.rows) {
    if (
      !SMOKE_SITES.some(
        ({ id, slug, key }) => id === row.id && slug === row.slug && key === row.widget_public_key
      )
    ) {
      throw new Error(`Reserved smoke site identity collision: ${row.id}/${row.slug}`);
    }
  }
}

export async function cleanupFixtures(client) {
  // Refuse to touch dependent rows if any reserved UUID, slug, or public key is
  // currently attached to a different identity. This check is intentionally done
  // again at cleanup time: cleanup must also be safe when seed was never run.
  await assertReservedIdentitiesAvailable(client);
  const ids = SMOKE_ORGANIZATIONS.map(({ id }) => id);
  const siteIds = SMOKE_SITES.map(({ id }) => id);
  const reservedSiteIdsSql = siteIds.map((id) => `'${id}'::uuid`).join(',');

  // These two tables do not carry site_id and do not cascade from conversations.
  await client.query(
    `delete from decision_events where conversation_id in
      (select id from conversations where site_id = any($1))`,
    [siteIds]
  );
  await client.query(
    `delete from messages where conversation_id in
      (select id from conversations where site_id = any($1))`,
    [siteIds]
  );

  // Delete only rows anchored to the three reserved site UUIDs. Repeated passes allow
  // dependent site-scoped tables to disappear before their parents, without ever using
  // organization_id as a broad deletion boundary.
  await client.query(
    `do $$
      declare t record; changed integer; total_changed integer := 1;
      begin
        while total_changed > 0 loop
          total_changed := 0;
          for t in select table_name from information_schema.columns
            where table_schema='public' and column_name='site_id' and table_name <> 'sites'
          loop
            begin
              execute format('delete from %I where site_id in (${reservedSiteIdsSql})', t.table_name);
              get diagnostics changed = row_count;
              total_changed := total_changed + changed;
            exception when foreign_key_violation then null;
            end;
          end loop;
        end loop;
      end $$`
  );
  await client.query('delete from sites where id = any($1) and slug = any($2)', [
    SMOKE_SITES.map(({ id }) => id),
    SMOKE_SITES.map(({ slug }) => slug)
  ]);
  await client.query('delete from organizations where id = any($1) and slug = any($2)', [
    ids,
    SMOKE_ORGANIZATIONS.map(({ slug }) => slug)
  ]);
}

export function smokeEnvironmentLines() {
  const [a1, a2, b1] = SMOKE_SITES;
  return [
    'CHATBOT_SMOKE_BASE_URL=http://127.0.0.1:3000',
    'CHATBOT_SMOKE_TIMEOUT_MS=10000',
    `CHATBOT_SMOKE_SITE_A_KEY=${a1.key}`,
    `CHATBOT_SMOKE_SITE_A_ORIGIN=${a1.origin}`,
    'CHATBOT_SMOKE_SITE_A_MARKER=SMOKE-SITE-A1-MARKER-ORCHID',
    `CHATBOT_SMOKE_SITE_A2_KEY=${a2.key}`,
    `CHATBOT_SMOKE_SITE_A2_ORIGIN=${a2.origin}`,
    'CHATBOT_SMOKE_SITE_A2_MARKER=SMOKE-SITE-A2-MARKER-SAFFRON',
    `CHATBOT_SMOKE_SITE_B_KEY=${b1.key}`,
    `CHATBOT_SMOKE_SITE_B_ORIGIN=${b1.origin}`,
    'CHATBOT_SMOKE_SITE_B_MARKER=SMOKE-SITE-B1-MARKER-INDIGO',
    'CHATBOT_SMOKE_SIMPLE_QUESTION=Quelle est la réponse simple synthétique ?',
    'CHATBOT_SMOKE_SIMPLE_EXPECT=SMOKE-A1-SIMPLE-ORCHID',
    'CHATBOT_SMOKE_PRICING_QUESTION=Quel est le tarif, la durée et le coût de livraison synthétiques ?',
    `CHATBOT_SMOKE_PRICING_EXPECT_JSON=["SMOKE-A1-PRICE-START-420","SMOKE-A1-PRICE-DURATION-3H","SMOKE-A1-PRICE-DELIVERY-200"]`,
    'CHATBOT_SMOKE_MULTIPART_QUESTION=Quels sont le check-in, le parking et le petit-déjeuner synthétiques ?',
    `CHATBOT_SMOKE_MULTIPART_EXPECT_JSON=["SMOKE-A1-MULTI-CHECKIN-17H","SMOKE-A1-MULTI-PARKING-VIOLET","SMOKE-A1-MULTI-BREAKFAST-07H30"]`,
    'CHATBOT_SMOKE_MISSING_QUESTION=Quel est le code de la navette lunaire SMOKE-MISSING-NEBULA-999 ?',
    'CHATBOT_SMOKE_SITE_ISOLATION_QUESTION=Quel est le marqueur propre à ce site ?',
    'CHATBOT_SMOKE_ORG_ISOLATION_QUESTION=Quel est le marqueur de cette organisation ?'
  ];
}
