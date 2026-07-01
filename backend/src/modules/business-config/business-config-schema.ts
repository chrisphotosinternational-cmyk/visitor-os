import { z } from 'zod';

const nonEmptyString = z.string().trim().min(1);
const optionalString = z.string().trim().optional();

export const businessRuleSchema = z.object({
  id: nonEmptyString,
  label: nonEmptyString,
  enabled: z.boolean().default(true),
  order: z.number().int().min(0).default(100),
  when: z.object({
    contains: z.array(nonEmptyString).min(1)
  }),
  then: z.object({
    action: z.enum(['human_escalation', 'fallback']),
    reply: optionalString,
    reason: nonEmptyString
  })
});

export const businessFaqSchema = z.object({
  id: nonEmptyString,
  category: nonEmptyString,
  question: nonEmptyString,
  keywords: z.array(nonEmptyString).min(1),
  answer: nonEmptyString,
  confidence: z.number().min(0).max(1),
  order: z.number().int().min(0).default(100),
  enabled: z.boolean().default(true)
});

export const knowledgeBaseItemSchema = z.object({
  id: nonEmptyString,
  title: nonEmptyString,
  content: nonEmptyString,
  category: nonEmptyString,
  tags: z.array(nonEmptyString).default([]),
  keywords: z.array(nonEmptyString).default([]),
  enabled: z.boolean().default(true)
});

export const businessConfigSchema = z.object({
  id: z
    .string()
    .trim()
    .min(1)
    .regex(/^[a-z0-9][a-z0-9-]*$/),
  version: nonEmptyString.default('1.0.0'),
  identity: z.object({
    name: nonEmptyString,
    slogan: optionalString,
    description: nonEmptyString,
    category: nonEmptyString,
    logoUrl: optionalString,
    colors: z
      .object({
        primary: optionalString,
        secondary: optionalString
      })
      .default({})
  }),
  contact: z.object({
    phone: optionalString,
    email: z.string().email().optional(),
    website: z.string().url().optional(),
    address: optionalString,
    googleMapsUrl: z.string().url().optional(),
    openingHours: z.array(nonEmptyString).default([])
  }),
  personality: z.object({
    tone: nonEmptyString,
    style: nonEmptyString,
    formalityLevel: z.enum(['casual', 'neutral', 'formal']).default('neutral'),
    vocabulary: z.array(nonEmptyString).default([]),
    defaultLanguage: nonEmptyString.default('fr'),
    availableLanguages: z.array(nonEmptyString).default(['fr'])
  }),
  goals: z.array(nonEmptyString).default(['lead_generation']),
  restrictions: z.object({
    never: z.array(nonEmptyString).default([]),
    always: z.array(nonEmptyString).default([])
  }),
  faq: z.array(businessFaqSchema).default([]),
  knowledgeBase: z.array(knowledgeBaseItemSchema).default([]),
  rules: z.array(businessRuleSchema).default([]),
  widget: z
    .object({
      welcomeMessage: optionalString,
      fallbackMessage: optionalString,
      quickReplies: z.array(nonEmptyString).default([])
    })
    .default({ quickReplies: [] })
});

export type BusinessConfig = z.infer<typeof businessConfigSchema>;
export type BusinessFaq = z.infer<typeof businessFaqSchema>;
export type KnowledgeBaseItem = z.infer<typeof knowledgeBaseItemSchema>;
export type BusinessRule = z.infer<typeof businessRuleSchema>;

export function validateBusinessConfig(value: unknown): BusinessConfig {
  return businessConfigSchema.parse(value);
}
