import type { KnowledgeChunk } from './knowledge-types.js';

export type EmbeddingVector = number[];

export interface EmbeddingProvider {
  embed(text: string): Promise<EmbeddingVector>;
}

export interface VectorProvider {
  upsert(chunks: KnowledgeChunk[], vectors: EmbeddingVector[]): Promise<void>;
  search(vector: EmbeddingVector, limit: number): Promise<KnowledgeChunk[]>;
}

export interface Retriever {
  retrieve(input: {
    organizationId: string;
    siteId?: string;
    question: string;
    limit: number;
  }): Promise<KnowledgeChunk[]>;
}

export interface ContextBuilder {
  buildContext(chunks: KnowledgeChunk[]): string;
}
