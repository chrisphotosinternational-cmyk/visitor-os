import { z } from 'zod';
import { knowledgeDocumentTypes } from './knowledge-types.js';

export const knowledgeImportSchema = z.object({
  organizationId: z.string().uuid(),
  siteId: z.string().uuid(),
  title: z.string().min(1).max(240),
  description: z.string().max(1000).optional(),
  category: z.string().min(1).max(120),
  type: z.enum(knowledgeDocumentTypes),
  language: z.string().min(2).default('fr'),
  content: z.string().min(1).max(1_000_000),
  tags: z.array(z.string().min(1).max(60)).default([]),
  author: z.string().max(120).optional(),
  source: z.string().max(240).default('manual')
});

export type ValidKnowledgeImport = z.infer<typeof knowledgeImportSchema>;

export class KnowledgeValidator {
  validateImport(input: unknown): ValidKnowledgeImport {
    return knowledgeImportSchema.parse(input);
  }
}
