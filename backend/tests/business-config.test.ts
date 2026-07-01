import assert from 'node:assert/strict';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { describe, it } from 'node:test';
import type { BusinessConfig } from '../src/modules/business-config/business-config-schema.js';
import { validateBusinessConfig } from '../src/modules/business-config/business-config-schema.js';
import { createBusinessConfigEngine } from '../src/modules/business-config/configuration-loader.js';
import { buildSystemPrompt } from '../src/modules/business-config/prompt-builder.js';

describe('business configuration engine', () => {
  it('loads and validates JSON configurations', async () => {
    const directory = await createTempConfigDirectory();

    try {
      await writeConfig(directory, validConfig);
      const engine = createBusinessConfigEngine({ configDirectory: directory });

      const startedAt = performance.now();
      await engine.loadAll();
      const loadTimeMs = performance.now() - startedAt;
      const configs = await engine.list();

      assert.equal(configs.length, 1);
      assert.equal(configs[0]?.id, 'test-business');
      assert.ok(loadTimeMs >= 0);
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  });

  it('rejects invalid configurations', () => {
    assert.throws(
      () =>
        validateBusinessConfig({
          id: 'Invalid ID',
          identity: {}
        }),
      /Invalid/
    );
  });

  it('imports, exports and stores history', async () => {
    const directory = await createTempConfigDirectory();

    try {
      const engine = createBusinessConfigEngine({ configDirectory: directory });
      const imported = await engine.importConfig({
        config: validConfig,
        author: 'test',
        comment: 'initial import'
      });
      const exported = await engine.exportConfig(imported.id);
      const history = await engine.listHistory(imported.id);

      assert.equal(exported.id, validConfig.id);
      assert.equal(history.length, 1);
      assert.equal(history[0]?.author, 'test');
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  });

  it('builds a future AI system prompt from the configuration', () => {
    const prompt = buildSystemPrompt(validConfig);

    assert.match(prompt, /Test Business/);
    assert.match(prompt, /Never:/);
    assert.match(prompt, /FAQ:/);
    assert.match(prompt, /Knowledge base:/);
    assert.match(prompt, /pricing_requires_human_confirmation/);
  });
});

async function createTempConfigDirectory(): Promise<string> {
  return mkdtemp(path.join(tmpdir(), 'visitor-os-config-'));
}

async function writeConfig(directory: string, config: BusinessConfig): Promise<void> {
  await writeFile(
    path.join(directory, `${config.id}.json`),
    `${JSON.stringify(config, null, 2)}\n`
  );
}

const validConfig: BusinessConfig = {
  id: 'test-business',
  version: '1.0.0',
  identity: {
    name: 'Test Business',
    slogan: 'Configurable',
    description: 'A business configured only through JSON.',
    category: 'test',
    colors: {
      primary: '#111827',
      secondary: '#f3f4f6'
    }
  },
  contact: {
    email: 'contact@example.com',
    website: 'https://example.com',
    openingHours: ['Monday to Friday']
  },
  personality: {
    tone: 'professional',
    style: 'concise',
    formalityLevel: 'neutral',
    vocabulary: ['clear', 'safe'],
    defaultLanguage: 'fr',
    availableLanguages: ['fr']
  },
  goals: ['lead_generation'],
  restrictions: {
    never: ['invent a price'],
    always: ['offer human contact when uncertain']
  },
  faq: [
    {
      id: 'parking',
      category: 'access',
      question: 'Is parking available?',
      keywords: ['parking'],
      answer: 'Parking information is available.',
      confidence: 0.9,
      order: 10,
      enabled: true
    }
  ],
  knowledgeBase: [
    {
      id: 'about',
      title: 'About',
      content: 'This is configurable knowledge.',
      category: 'general',
      tags: ['about'],
      keywords: ['about'],
      enabled: true
    }
  ],
  rules: [
    {
      id: 'pricing',
      label: 'Pricing',
      enabled: true,
      order: 10,
      when: {
        contains: ['price']
      },
      then: {
        action: 'human_escalation',
        reason: 'pricing_requires_human_confirmation'
      }
    }
  ],
  widget: {
    welcomeMessage: 'Hello.',
    fallbackMessage: 'Please contact us.',
    quickReplies: ['Contact']
  }
};
