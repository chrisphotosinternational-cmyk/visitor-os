import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';

const stagingWarning =
  'STAGING-ONLY smoke test: this workflow creates persistent conversations/prospects and must not be run against client production data.';
const forbiddenPublicKeys = new Set([
  'debug',
  'prompt',
  'kmsContext',
  'rawLlmResponse',
  'injectedChunks',
  'chunksBeforeReranking',
  'chunksAfterReranking'
]);
const publicSources = new Set([
  'faq',
  'knowledge_search',
  'knowledge_base',
  'ai',
  'fallback',
  'human_escalation'
]);
const requiredVariables = [
  'CHATBOT_SMOKE_BASE_URL',
  'CHATBOT_SMOKE_TIMEOUT_MS',
  'CHATBOT_SMOKE_SITE_A_KEY',
  'CHATBOT_SMOKE_SITE_A_ORIGIN',
  'CHATBOT_SMOKE_SITE_A_MARKER',
  'CHATBOT_SMOKE_SITE_A2_KEY',
  'CHATBOT_SMOKE_SITE_A2_ORIGIN',
  'CHATBOT_SMOKE_SITE_A2_MARKER',
  'CHATBOT_SMOKE_SITE_B_KEY',
  'CHATBOT_SMOKE_SITE_B_ORIGIN',
  'CHATBOT_SMOKE_SITE_B_MARKER',
  'CHATBOT_SMOKE_SIMPLE_QUESTION',
  'CHATBOT_SMOKE_SIMPLE_EXPECT',
  'CHATBOT_SMOKE_PRICING_QUESTION',
  'CHATBOT_SMOKE_PRICING_EXPECT_JSON',
  'CHATBOT_SMOKE_MULTIPART_QUESTION',
  'CHATBOT_SMOKE_MULTIPART_EXPECT_JSON',
  'CHATBOT_SMOKE_MISSING_QUESTION',
  'CHATBOT_SMOKE_SITE_ISOLATION_QUESTION',
  'CHATBOT_SMOKE_ORG_ISOLATION_QUESTION'
];

console.log(stagingWarning);

try {
  const settings = loadSettings(process.env);
  await runSmokeTest(settings);
} catch (error) {
  const message = error instanceof Error ? error.message : 'Unknown smoke test failure';
  console.error(`[FAIL] ${message}`);
  process.exitCode = 1;
}

function loadSettings(environment) {
  const missing = requiredVariables.filter((name) => !environment[name]?.trim());
  if (missing.length > 0) {
    throw new Error(`missing required environment variables: ${missing.join(', ')}`);
  }

  const timeoutMs = Number(environment.CHATBOT_SMOKE_TIMEOUT_MS);
  assert.ok(
    Number.isInteger(timeoutMs) && timeoutMs > 0,
    'CHATBOT_SMOKE_TIMEOUT_MS must be a positive integer'
  );

  const baseUrl = parseUrl(environment.CHATBOT_SMOKE_BASE_URL, 'CHATBOT_SMOKE_BASE_URL');
  const fixtures = {
    a1: fixture(environment, 'A'),
    a2: fixture(environment, 'A2'),
    b1: fixture(environment, 'B')
  };

  return {
    baseUrl,
    timeoutMs,
    fixtures,
    questions: {
      simple: environment.CHATBOT_SMOKE_SIMPLE_QUESTION,
      simpleExpected: environment.CHATBOT_SMOKE_SIMPLE_EXPECT,
      pricing: environment.CHATBOT_SMOKE_PRICING_QUESTION,
      pricingExpected: parseStringArray(
        environment.CHATBOT_SMOKE_PRICING_EXPECT_JSON,
        'CHATBOT_SMOKE_PRICING_EXPECT_JSON'
      ),
      multipart: environment.CHATBOT_SMOKE_MULTIPART_QUESTION,
      multipartExpected: parseStringArray(
        environment.CHATBOT_SMOKE_MULTIPART_EXPECT_JSON,
        'CHATBOT_SMOKE_MULTIPART_EXPECT_JSON'
      ),
      missing: environment.CHATBOT_SMOKE_MISSING_QUESTION,
      fallbackExpected: environment.CHATBOT_SMOKE_FALLBACK_EXPECT?.trim() ?? '',
      siteIsolation: environment.CHATBOT_SMOKE_SITE_ISOLATION_QUESTION,
      organizationIsolation: environment.CHATBOT_SMOKE_ORG_ISOLATION_QUESTION
    }
  };
}

function fixture(environment, suffix) {
  const prefix = `CHATBOT_SMOKE_SITE_${suffix}`;
  return {
    key: environment[`${prefix}_KEY`],
    origin: parseUrl(environment[`${prefix}_ORIGIN`], `${prefix}_ORIGIN`).origin,
    marker: environment[`${prefix}_MARKER`]
  };
}

function parseUrl(value, name) {
  try {
    const parsed = new URL(value);
    assert.ok(['http:', 'https:'].includes(parsed.protocol), `${name} must use HTTP or HTTPS`);
    return parsed;
  } catch (error) {
    if (error instanceof assert.AssertionError) throw error;
    throw new Error(`${name} must be a valid URL`);
  }
}

function parseStringArray(value, name) {
  let parsed;
  try {
    parsed = JSON.parse(value);
  } catch {
    throw new Error(`${name} must be valid JSON`);
  }
  assert.ok(
    Array.isArray(parsed) && parsed.length > 0 && parsed.every(isNonEmptyString),
    `${name} must be a non-empty JSON array of non-empty strings`
  );
  return parsed;
}

function isNonEmptyString(value) {
  return typeof value === 'string' && value.trim().length > 0;
}

async function runSmokeTest(settings) {
  const client = createPublicClient(settings.baseUrl, settings.timeoutMs);
  const responses = [];

  await client.expectOk('/health', 'health');
  pass('health');
  await client.expectOk('/live', 'live');
  pass('live');
  await client.expectOk('/ready', 'ready');
  pass('ready');

  await validateFixture(client, settings.fixtures.a1, 'A1');
  await validateFixture(client, settings.fixtures.a2, 'A2');
  await validateFixture(client, settings.fixtures.b1, 'B1');

  const simple = await ask(client, settings.fixtures.a1, settings.questions.simple, 'simple');
  responses.push(simple);
  assertContains(simple.reply, settings.questions.simpleExpected, 'simple expected marker missing');
  assertGrounded(simple, 'simple');
  pass('simple grounding');

  const pricing = await ask(client, settings.fixtures.a1, settings.questions.pricing, 'pricing');
  responses.push(pricing);
  assertFragments(pricing.reply, settings.questions.pricingExpected, 'pricing');
  assertGrounded(pricing, 'pricing');
  pass('pricing exhaustive');

  const multipart = await ask(
    client,
    settings.fixtures.a1,
    settings.questions.multipart,
    'multipart'
  );
  responses.push(multipart);
  assertFragments(multipart.reply, settings.questions.multipartExpected, 'multipart');
  assertGrounded(multipart, 'multipart');
  pass('multipart');

  const missing = await ask(
    client,
    settings.fixtures.a1,
    settings.questions.missing,
    'missing information'
  );
  responses.push(missing);
  assert.equal(missing.source, 'fallback', 'missing information must use fallback');
  if (settings.questions.fallbackExpected) {
    assertContains(
      missing.reply,
      settings.questions.fallbackExpected,
      'fallback expected marker missing'
    );
  }
  assertEmptyOptionalArray(missing.citations, 'fallback citations must be empty');
  assertEmptyOptionalArray(missing.usedChunkIds, 'fallback usedChunkIds must be empty');
  assertNoUnexpectedNumbers(missing.reply, settings.questions.fallbackExpected);
  pass('missing information fallback');

  const siteA1 = await ask(
    client,
    settings.fixtures.a1,
    settings.questions.siteIsolation,
    'site isolation A1'
  );
  const siteA2 = await ask(
    client,
    settings.fixtures.a2,
    settings.questions.siteIsolation,
    'site isolation A2'
  );
  responses.push(siteA1, siteA2);
  assertMarkerIsolation(siteA1.reply, settings.fixtures.a1.marker, [
    settings.fixtures.a2.marker,
    settings.fixtures.b1.marker
  ]);
  assertMarkerIsolation(siteA2.reply, settings.fixtures.a2.marker, [
    settings.fixtures.a1.marker,
    settings.fixtures.b1.marker
  ]);
  assertGrounded(siteA1, 'site isolation A1');
  assertGrounded(siteA2, 'site isolation A2');
  pass('site isolation');

  const organizationA = await ask(
    client,
    settings.fixtures.a1,
    settings.questions.organizationIsolation,
    'organization isolation A'
  );
  const organizationB = await ask(
    client,
    settings.fixtures.b1,
    settings.questions.organizationIsolation,
    'organization isolation B'
  );
  responses.push(organizationA, organizationB);
  assertNotContains(
    organizationA.reply,
    settings.fixtures.b1.marker,
    'organization A response leaked organization B marker'
  );
  assertMarkerIsolation(organizationB.reply, settings.fixtures.b1.marker, [
    settings.fixtures.a1.marker,
    settings.fixtures.a2.marker
  ]);
  assertGrounded(organizationA, 'organization isolation A');
  assertGrounded(organizationB, 'organization isolation B');
  pass('organization isolation');

  const reasoning = await ask(
    client,
    settings.fixtures.a1,
    settings.questions.simple,
    'reasoning preservation'
  );
  responses.push(reasoning);
  assertContains(
    reasoning.reply,
    settings.questions.simpleExpected,
    'reasoning replaced the grounded marker'
  );
  assertGrounded(reasoning, 'reasoning preservation');
  pass('reasoning preservation');

  for (const response of responses) assertNoForbiddenKeys(response);
  pass('public response secrecy');
  console.log(
    '[SKIP] forced numeric hallucination - deterministic provider required; not deterministic in black-box staging'
  );
}

function createPublicClient(baseUrl, timeoutMs) {
  async function request(path, label, options = {}) {
    let response;
    try {
      response = await fetch(new URL(path, baseUrl), {
        ...options,
        signal: AbortSignal.timeout(timeoutMs),
        headers: {
          accept: 'application/json',
          ...(options.body ? { 'content-type': 'application/json' } : {}),
          ...(options.headers ?? {})
        }
      });
    } catch {
      throw new Error(`${label}: network request failed`);
    }
    assert.ok(response.ok, `${label}: unexpected HTTP status ${response.status}`);
    return response;
  }

  return {
    request,
    async expectOk(path, label) {
      await request(path, label);
    },
    async json(path, label, options) {
      const response = await request(path, label, options);
      try {
        return await response.json();
      } catch {
        throw new Error(`${label}: response is not valid JSON`);
      }
    }
  };
}

async function validateFixture(client, fixtureValue, label) {
  const script = await client.request(
    `/widget/${encodeURIComponent(fixtureValue.key)}.js`,
    `widget ${label}`,
    { headers: { origin: fixtureValue.origin } }
  );
  const contentType = script.headers.get('content-type') ?? '';
  const body = await script.text();
  assert.match(contentType, /javascript/i, `widget ${label}: invalid content type`);
  assert.ok(body.trim().length > 0, `widget ${label}: empty JavaScript response`);

  const config = await client.json(
    `/api/widget/config?siteKey=${encodeURIComponent(fixtureValue.key)}`,
    `widget config ${label}`,
    { headers: { origin: fixtureValue.origin } }
  );
  assert.equal(config.siteKey, fixtureValue.key, `widget ${label}: public configuration mismatch`);
  assert.ok(isNonEmptyString(config.brandName), `widget ${label}: brandName is missing`);
  assert.ok(isNonEmptyString(config.welcomeMessage), `widget ${label}: welcomeMessage is missing`);
  assertNoForbiddenKeys(config);
  pass(`widget ${label}`);
}

async function ask(client, fixtureValue, question, label) {
  const conversation = await client.json('/api/widget/conversations', `${label} conversation`, {
    method: 'POST',
    headers: { origin: fixtureValue.origin },
    body: JSON.stringify({
      siteKey: fixtureValue.key,
      anonymousId: `smoke-${randomUUID()}`,
      pageUrl: `${fixtureValue.origin}/chatbot-smoke`
    })
  });
  assert.ok(
    isNonEmptyString(conversation.conversationId),
    `${label}: conversation was not created`
  );

  const response = await client.json(
    `/api/widget/conversations/${encodeURIComponent(conversation.conversationId)}/messages`,
    `${label} message`,
    {
      method: 'POST',
      headers: { origin: fixtureValue.origin },
      body: JSON.stringify({ content: question })
    }
  );
  assertCommonResponse(response, conversation.conversationId, label);
  return response;
}

function assertCommonResponse(response, conversationId, label) {
  assert.ok(response && typeof response === 'object', `${label}: invalid public response`);
  assert.equal(response.conversationId, conversationId, `${label}: conversation mismatch`);
  assert.ok(isNonEmptyString(response.reply), `${label}: empty reply`);
  assert.ok(publicSources.has(response.source), `${label}: unsupported public source`);
  assert.ok(
    typeof response.confidence === 'number' &&
      Number.isFinite(response.confidence) &&
      response.confidence >= 0 &&
      response.confidence <= 1,
    `${label}: invalid confidence`
  );
  assertNoForbiddenKeys(response);
}

function assertGrounded(response, label) {
  assert.equal(response.source, 'ai', `${label}: expected grounded AI source`);
  assert.ok(nonEmptyArray(response.citations), `${label}: citations are required`);
  assert.ok(nonEmptyArray(response.sources), `${label}: declared sources are required`);
  assert.ok(nonEmptyArray(response.usedChunkIds), `${label}: usedChunkIds are required`);
  assert.ok(nonEmptyArray(response.usedDocumentIds), `${label}: usedDocumentIds are required`);

  const chunkIds = new Set(response.usedChunkIds);
  const documentIds = new Set(response.usedDocumentIds);
  for (const citation of response.citations) {
    assert.ok(chunkIds.has(citation.chunkId), `${label}: citation chunk is not declared as used`);
    assert.ok(
      documentIds.has(citation.documentId),
      `${label}: citation document is not declared as used`
    );
    assert.ok(
      response.sources.some(
        (source) => source.chunkId === citation.chunkId && source.documentId === citation.documentId
      ),
      `${label}: citation has no corresponding declared source`
    );
  }
}

function assertNoForbiddenKeys(value) {
  if (!value || typeof value !== 'object') return;
  if (Array.isArray(value)) {
    for (const item of value) assertNoForbiddenKeys(item);
    return;
  }
  for (const [key, nested] of Object.entries(value)) {
    assert.ok(
      !forbiddenPublicKeys.has(key),
      `public response contains forbidden internal key: ${key}`
    );
    assertNoForbiddenKeys(nested);
  }
}

function assertFragments(reply, fragments, label) {
  for (const fragment of fragments) {
    assertContains(reply, fragment, `${label}: expected fragment missing`);
  }
}

function assertMarkerIsolation(reply, required, forbidden) {
  assertContains(reply, required, 'expected isolation marker missing');
  for (const marker of forbidden) {
    assertNotContains(reply, marker, 'response leaked a forbidden isolation marker');
  }
}

function assertContains(value, expected, message) {
  assert.ok(normalize(value).includes(normalize(expected)), message);
}

function assertNotContains(value, forbidden, message) {
  assert.ok(!normalize(value).includes(normalize(forbidden)), message);
}

function normalize(value) {
  return String(value).normalize('NFKC').toLocaleLowerCase('fr');
}

function nonEmptyArray(value) {
  return Array.isArray(value) && value.length > 0;
}

function assertEmptyOptionalArray(value, message) {
  assert.ok(value === undefined || (Array.isArray(value) && value.length === 0), message);
}

function assertNoUnexpectedNumbers(reply, expected) {
  const expectedNumbers = new Set(String(expected).match(/\b\d+(?:[.,]\d+)?\b/g) ?? []);
  const replyNumbers = String(reply).match(/\b\d+(?:[.,]\d+)?\b/g) ?? [];
  assert.ok(
    replyNumbers.every((number) => expectedNumbers.has(number)),
    'fallback reply contains an unexpected numeric value'
  );
}

function pass(label) {
  console.log(`[PASS] ${label}`);
}
