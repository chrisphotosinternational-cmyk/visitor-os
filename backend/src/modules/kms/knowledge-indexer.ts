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

  if (!config.splitByParagraph) return splitBlock(normalized, config);

  const blocks = normalized
    .split(/\n{2,}/)
    .map((paragraph) => paragraph.trim())
    .filter(Boolean);
  const chunks: string[] = [];
  let pending: string[] = [];

  const flushPending = (): void => {
    if (pending.length === 0) return;
    chunks.push(...packBlocks(pending, config));
    pending = [];
  };

  for (const block of blocks) {
    // A FAQ answer must never be detached from its question or mixed with a
    // neighbouring answer. It is a useful semantic chunk even when it is short.
    if (isFaqBlock(block)) {
      flushPending();
      chunks.push(...splitBlock(block, config));
    } else {
      pending.push(block);
    }
  }
  flushPending();

  return mergeTinyChunks(chunks, config.maxCharacters);
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

function packBlocks(blocks: string[], config: KnowledgeChunkingConfig): string[] {
  const chunks: string[] = [];
  let current = '';

  for (const block of blocks) {
    if (block.length > config.maxCharacters) {
      if (current) chunks.push(current);
      current = '';
      chunks.push(...splitBlock(block, config));
      continue;
    }

    const candidate = current ? `${current}\n\n${block}` : block;
    if (candidate.length <= config.maxCharacters) {
      current = candidate;
      continue;
    }

    chunks.push(current);
    const overlap = semanticTail(current, config.overlapCharacters);
    const withOverlap = overlap ? `${overlap}\n\n${block}` : block;
    current = withOverlap.length <= config.maxCharacters ? withOverlap : block;
  }

  if (current) chunks.push(current);
  return chunks;
}

function semanticTail(value: string, maximum: number): string {
  if (maximum <= 0) return '';
  const tail = value.slice(-maximum);
  const paragraphBreak = tail.indexOf('\n\n');
  if (paragraphBreak >= 0) return tail.slice(paragraphBreak + 2).trim();
  const sentenceBreak = Math.max(tail.indexOf('. '), tail.indexOf('? '), tail.indexOf('! '));
  if (sentenceBreak >= 0) return tail.slice(sentenceBreak + 2).trim();
  const wordBreak = tail.indexOf(' ');
  return (wordBreak >= 0 ? tail.slice(wordBreak + 1) : tail).trim();
}

function mergeTinyChunks(chunks: string[], maximum: number): string[] {
  const minimumUsefulLength = 50;
  const merged: string[] = [];

  for (const chunk of chunks.filter(Boolean)) {
    if (
      chunk.length < minimumUsefulLength &&
      !isFaqBlock(chunk) &&
      merged.length > 0 &&
      merged[merged.length - 1]!.length + chunk.length + 2 <= maximum
    ) {
      merged[merged.length - 1] = `${merged[merged.length - 1]}\n\n${chunk}`;
    } else {
      merged.push(chunk);
    }
  }

  if (
    merged.length > 1 &&
    merged[0]!.length < minimumUsefulLength &&
    !isFaqBlock(merged[0]!) &&
    merged[0]!.length + merged[1]!.length + 2 <= maximum
  ) {
    merged.splice(0, 2, `${merged[0]}\n\n${merged[1]}`);
  }

  return merged;
}

function isFaqBlock(block: string): boolean {
  return /^FAQ Question:/i.test(block) && /(?:^|\n)FAQ Answer:/i.test(block);
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
