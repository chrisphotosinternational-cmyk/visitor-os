# Prompt 14 - AI Provider Engine

Sprint 6 introduces a provider-neutral AI layer.

Commit target:

```text
Prompt 14: Implement AI Provider Engine
```

Rules:

- do not couple the Decision Engine to OpenAI;
- keep FAQ, knowledge base and business rules before AI;
- provide a mock provider for zero-cost tests;
- fall back safely when a provider is unavailable;
- document provider configuration, OpenAI and cost estimation.
