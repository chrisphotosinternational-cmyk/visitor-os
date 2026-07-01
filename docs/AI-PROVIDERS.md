# AI Providers

VISITOR-OS uses an AI Provider Engine so the Decision Engine never depends on a vendor.

## Principle

The Decision Engine only calls the `AIProvider` interface.

```text
Decision Engine
  -> AIProvider
  -> ProviderFactory
  -> OpenAI | Anthropic | Mistral | Ollama | Mock
```

The provider receives:

- organization id;
- site id;
- conversation id;
- generated system prompt;
- recent conversation messages;
- provider configuration;
- business context.

The provider never builds the prompt itself.

## Providers

- `MockAIProvider`: default, zero cost, used for tests and fallback.
- `OpenAIProvider`: prepared for real OpenAI calls through `OPENAI_API_KEY`.
- `PreparedProvider`: placeholder for Anthropic, Mistral and Ollama.

## Fallback

If a provider is unavailable, times out, has no key or is not implemented, VISITOR-OS falls back to
the mock provider. The application must continue to answer safely instead of crashing.

## Events

Each AI call can produce an `ai_events` row with:

- provider;
- model;
- latency;
- input tokens;
- output tokens;
- estimated cost;
- organization;
- site;
- conversation;
- timestamp.
