# Knowledge Indexation

RC1 uses simple text chunking.

The indexer splits content by paragraphs and stores:

- chunk id
- document id
- organization id
- optional site id
- content
- position
- tokens
- metadata

## Future

The same chunk model can later receive:

- embeddings
- vector database ids
- semantic retrieval metadata

No embedding is generated in RC1.
