import assert from 'node:assert/strict';
import { test } from 'node:test';
import { chatbotConversationScenarios } from '../benchmarks/chatbot-conversations.js';
import {
  formatRuntimeBenchmarkReport,
  runConversationRuntimeBenchmark,
  searchRuntimeBenchmarkKnowledge
} from '../src/modules/visitor-evaluation/conversation-runtime-benchmark-runner.js';
import { chatbotBenchmarkFixtures } from './fixtures/chatbot-benchmark-fixtures.js';

test('runs the 43-scenario deterministic corpus through the real chatbot runtime', async () => {
  const report = await runConversationRuntimeBenchmark({
    scenarios: chatbotConversationScenarios,
    fixtures: chatbotBenchmarkFixtures
  });

  assert.equal(report.scenarioResults.length, 43);
  assert.equal(report.runtimeScenarios.length, 43);
  assert.equal(new Set(report.runtimeScenarios.map((scenario) => scenario.scenarioId)).size, 43);
  assert.ok(report.runtimeScenarios.every((scenario) => scenario.executions.length > 0));
  assert.ok(report.score >= 0 && report.score <= 100);
  assert.ok(Object.keys(report.metricScores).length > 0);
  assert.ok(Object.keys(report.categoryScores).length === 6);

  const fixedScenarioIds = ['KMS-09', 'KMS-10', 'KMS-12', 'KMS-16'];
  for (const scenarioId of fixedScenarioIds) {
    const scored = report.scenarioResults.find((scenario) => scenario.scenarioId === scenarioId);
    const runtime = report.runtimeScenarios.find((scenario) => scenario.scenarioId === scenarioId);
    assert.equal(scored?.passed, true, `${scenarioId} should be grounded and pass`);
    assert.ok(runtime);
    for (const execution of runtime.executions) {
      const payload = execution.publicPayload ?? {};
      assert.equal(payload.source, 'ai');
      assert.ok((payload.confidence as number) > 0);
      assert.ok((payload.usedChunkIds as string[]).length > 0);
      assert.ok((payload.usedDocumentIds as string[]).length > 0);
      assert.ok((payload.citations as unknown[]).length > 0);
      assert.equal(
        (payload.citations as Array<{ sourceNumber: number }>).some(
          (citation) => citation.sourceNumber === 1
        ),
        true
      );
      assert.doesNotMatch(execution.answer, /information est absente/i);
    }
  }
  assert.equal(report.blockerCount, 0);
  assert.deepEqual(report.failedScenarioIds, []);

  console.log(`\n${formatRuntimeBenchmarkReport(report)}\n`);
});

test('isolates the four A1 runtime knowledge chunks by site and organization', async () => {
  const facts = [
    'DEPLACEMENT-A1-COPPER',
    'STUDIO-A1-VIOLET',
    'PROCESS-A1-BOOKING',
    'VIDEO-A1'
  ];
  for (const fact of facts) {
    const a1 = await searchRuntimeBenchmarkKnowledge({
      fixtures: chatbotBenchmarkFixtures,
      organizationId: 'organization-a',
      siteId: 'site-a1',
      query: fact
    });
    const matchingResults = a1.filter((result) => result.content.includes(fact));
    assert.ok(matchingResults.length > 0);
    assert.ok(matchingResults.every((result) => result.source.startsWith('benchmark://site-a1/')));

    for (const tenant of [
      { organizationId: 'organization-a', siteId: 'site-a2' },
      { organizationId: 'organization-b', siteId: 'site-b1' }
    ]) {
      const results = await searchRuntimeBenchmarkKnowledge({
        fixtures: chatbotBenchmarkFixtures,
        ...tenant,
        query: fact
      });
      assert.equal(results.some((result) => result.content.includes(fact)), false);
    }
  }
});
