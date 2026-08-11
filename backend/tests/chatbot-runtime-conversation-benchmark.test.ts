import assert from 'node:assert/strict';
import { test } from 'node:test';
import { chatbotConversationScenarios } from '../benchmarks/chatbot-conversations.js';
import {
  formatRuntimeBenchmarkReport,
  runConversationRuntimeBenchmark
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

  console.log(`\n${formatRuntimeBenchmarkReport(report)}\n`);
});
