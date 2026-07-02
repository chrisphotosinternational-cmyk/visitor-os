# Knowledge Management System

VISITOR-OS RC1 introduces a Knowledge Management System.

The KMS stores, validates, versions, indexes and searches documents before the Decision Engine calls AI. It is intentionally simple in RC1 and ready for future RAG.

## Components

- KnowledgeRepository
- KnowledgeImporter
- KnowledgeIndexer
- KnowledgeSearch
- KnowledgeDocument
- KnowledgeCategory
- KnowledgeSource
- KnowledgeVersion
- KnowledgeValidator
- KnowledgeStatistics

## Decision Priority

```text
FAQ -> Knowledge Search -> Knowledge Base -> AI Provider -> Fallback -> Escalation
```

The engine now prefers validated documents before AI.

## Multi-Tenant

All documents are isolated by organization and optionally scoped by site.

Admin KMS routes require `settings:access`.
