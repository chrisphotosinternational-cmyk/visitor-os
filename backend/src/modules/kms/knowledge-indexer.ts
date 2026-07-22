import { createHash } from 'node:crypto';
import type {
  KnowledgeChunk,
  KnowledgeChunkingConfig,
  KnowledgeChunkingInput
} from './knowledge-types.js';

export const defaultKnowledgeChunkingConfig: KnowledgeChunkingConfig = {
  maxCharacters: 1200,
  overlapCharacters: 120,
  splitByParagraph: true
};

export class KnowledgeIndexer {
  createChunks(input: {
    documentId: string;
    organizationId: string;
    siteId: string;
    content: string;
    config?: KnowledgeChunkingInput;
  }): KnowledgeChunk[] {
    const config = normalizeChunkingConfig(input.config);
    const chunks = chunkKnowledgeText(input.content, config);

    return chunks.map((content, index) => ({
      id: createHash('sha256').update(`${input.documentId}:${index}:${content}`).digest('hex'),
      documentId: input.documentId,
      organizationId: input.organizationId,
      siteId: input.siteId,
      content,
      position: index,
      tokens: tokenize(content),
      metadata: {
        length: content.length,
        maxCharacters: config.maxCharacters,
        overlapCharacters: config.overlapCharacters
      }
    }));
  }
}

export function chunkKnowledgeText(
  content: string,
  config: KnowledgeChunkingConfig = defaultKnowledgeChunkingConfig
): string[] {
  const normalized = content.replace(/\r\n/g, '\n').trim();
  if (!normalized) return [];

  const blocks = config.splitByParagraph
    ? normalized
        .split(/\n{2,}/)
        .map((paragraph) => paragraph.trim())
        .filter(Boolean)
    : [normalized];
  const chunks: string[] = [];

  for (const block of blocks) {
    chunks.push(...splitBlock(block, config));
  }

  return chunks.length > 0 ? chunks : [normalized];
}

export function tokenizeKnowledge(value: string): string[] {
  return tokenize(value);
}

function normalizeChunkingConfig(config?: KnowledgeChunkingInput): KnowledgeChunkingConfig {
  const maxCharacters = Math.max(200, Math.min(config?.maxCharacters ?? 1200, 6000));
  const overlapCharacters = Math.max(
    0,
    Math.min(config?.overlapCharacters ?? 120, Math.floor(maxCharacters / 3))
  );

  return {
    maxCharacters,
    overlapCharacters,
    splitByParagraph: config?.splitByParagraph ?? true
  };
}

function splitBlock(block: string, config: KnowledgeChunkingConfig): string[] {
  if (block.length <= config.maxCharacters) return [block];

  const chunks: string[] = [];
  let start = 0;

  while (start < block.length) {
    const hardEnd = Math.min(start + config.maxCharacters, block.length);
    const softEnd = findSoftBreak(block, start, hardEnd);
    const chunk = block.slice(start, softEnd).trim();
    if (chunk) chunks.push(chunk);
    if (softEnd >= block.length) break;
    start = Math.max(softEnd - config.overlapCharacters, start + 1);
  }

  return chunks;
}

function findSoftBreak(block: string, start: number, hardEnd: number): number {
  if (hardEnd >= block.length) return block.length;

  const window = block.slice(start, hardEnd);
  const sentenceBreak = Math.max(
    window.lastIndexOf('. '),
    window.lastIndexOf('? '),
    window.lastIndexOf('! ')
  );
  if (sentenceBreak > window.length * 0.5) return start + sentenceBreak + 1;

  const spaceBreak = window.lastIndexOf(' ');
  if (spaceBreak > window.length * 0.6) return start + spaceBreak;

  return hardEnd;
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
