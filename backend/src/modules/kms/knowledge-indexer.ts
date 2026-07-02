import { createHash } from 'node:crypto';
import type { KnowledgeChunk } from './knowledge-types.js';

export class KnowledgeIndexer {
  createChunks(input: {
    documentId: string;
    organizationId: string;
    siteId?: string;
    content: string;
  }): KnowledgeChunk[] {
    const paragraphs = input.content
      .split(/\n{2,}/)
      .map((paragraph) => paragraph.trim())
      .filter(Boolean);
    const chunks = paragraphs.length > 0 ? paragraphs : [input.content.trim()];

    return chunks.map((content, index) => ({
      id: createHash('sha256').update(`${input.documentId}:${index}:${content}`).digest('hex'),
      documentId: input.documentId,
      organizationId: input.organizationId,
      ...(input.siteId ? { siteId: input.siteId } : {}),
      content,
      position: index,
      tokens: tokenize(content),
      metadata: { length: content.length }
    }));
  }
}

export function tokenizeKnowledge(value: string): string[] {
  return tokenize(value);
}

function tokenize(value: string): string[] {
  return [
    ...new Set(
      value
        .toLowerCase()
        .normalize('NFD')
        .replace(/\p{Diacritic}/gu, '')
        .replace(/[^a-z0-9]+/g, ' ')
        .split(' ')
        .map((token) => token.trim())
        .filter((token) => token.length >= 3)
    )
  ];
}
