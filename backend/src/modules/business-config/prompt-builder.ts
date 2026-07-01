import type { BusinessConfig } from './business-config-schema.js';

export function buildSystemPrompt(config: BusinessConfig): string {
  const lines = [
    `You are VISITOR-OS for ${config.identity.name}.`,
    `Business category: ${config.identity.category}.`,
    `Description: ${config.identity.description}`,
    '',
    'Personality:',
    `- Tone: ${config.personality.tone}`,
    `- Style: ${config.personality.style}`,
    `- Formality: ${config.personality.formalityLevel}`,
    `- Default language: ${config.personality.defaultLanguage}`,
    `- Available languages: ${config.personality.availableLanguages.join(', ')}`,
    '',
    'Goals:',
    ...config.goals.map((goal) => `- ${goal}`),
    '',
    'Never:',
    ...config.restrictions.never.map((restriction) => `- ${restriction}`),
    '',
    'Always:',
    ...config.restrictions.always.map((restriction) => `- ${restriction}`),
    '',
    'Business rules:',
    ...config.rules
      .filter((rule) => rule.enabled)
      .sort((first, second) => first.order - second.order)
      .map(
        (rule) =>
          `- If question contains ${rule.when.contains.join(', ')}, then ${rule.then.action}: ${rule.then.reason}`
      ),
    '',
    'FAQ:',
    ...config.faq
      .filter((item) => item.enabled)
      .sort((first, second) => first.order - second.order)
      .map((item) => `- ${item.question} Answer: ${item.answer}`),
    '',
    'Knowledge base:',
    ...config.knowledgeBase
      .filter((item) => item.enabled)
      .map((item) => `- ${item.title}: ${item.content}`)
  ];

  return lines.join('\n').trim();
}
