# RAG Ready

RC1 does not implement Retrieval-Augmented Generation.

It only creates the architecture required to add RAG later without rewriting the Decision Engine.

## Interfaces

- `KnowledgeChunk`
- `EmbeddingProvider`
- `VectorProvider`
- `Retriever`
- `ContextBuilder`

## Future Providers

Prepared targets:

- OpenAI Embeddings
- Pinecone
- Qdrant
- Weaviate
- pgvector
