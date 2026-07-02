# RAG Architecture

RC2 prepare le RAG sans l'activer.

## Interfaces

Interfaces preparees :

- `EmbeddingProvider` ;
- `VectorProvider` ;
- `Retriever` ;
- `ContextBuilder`.

## Flux Futur

```text
Document
-> chunks
-> embeddings
-> vector store
-> retrieval
-> contexte
-> AI Provider
```

## Non Inclus en RC2

- OpenAI Embeddings ;
- pgvector ;
- Qdrant ;
- Pinecone ;
- Weaviate ;
- reranking ;
- generation augmentee active.

## Option Recommandee pour RC3

Evaluer d'abord `pgvector`.

Raison :

- PostgreSQL est deja la base principale ;
- cout faible ;
- maintenance reduite ;
- migration plus simple pour une seule personne.

Qdrant reste pertinent si :

- volume important ;
- recherche vectorielle centrale ;
- besoin de scaling dedie.

