# Knowledge Search

RC2 search is token-based and document-oriented.

Search supports:

- title
- content chunks
- tags
- category through filters
- language
- organization
- site

Each result returns:

- score
- relevance
- language
- source
- document id

Searches are journaled for future analytics.

## Decision Engine Order

The Decision Engine keeps documents before AI:

```text
FAQ
-> Knowledge Search
-> Knowledge Base
-> AI Provider
-> Fallback
-> Escalation
```

RC2 does not include AI reranking.
