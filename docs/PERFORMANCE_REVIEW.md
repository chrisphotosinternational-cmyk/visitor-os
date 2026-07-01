# Performance Review - VISITOR-OS v0.1.0 RC

## Summary

The MVP is small and fast enough for local/staging use. No heavy computation, AI call, queue, or large frontend bundle exists yet.

## Backend

Strengths:

- Minimal Fastify app.
- Parameterized PostgreSQL queries.
- List endpoints capped to 100 rows.
- No blocking CPU work.
- No expensive startup tasks beyond schema initialization and seed.

Risks:

- Startup schema initialization should move to migrations later.
- Conversation search uses `ILIKE` and `exists`; acceptable for MVP, but will need indexes/full-text search later.
- Prospect detail loads messages per conversation; acceptable now, but may need query consolidation later.

## Widget

Strengths:

- No framework.
- Small static script.
- Uses one conversation start call and one message send call.

Risks:

- Inline styles are acceptable for embed MVP, but theming should become configuration-driven later.

## Admin

Strengths:

- Small static interface.
- Minimal data fetching.
- Search is server-side.

Risks:

- Vue CDN loading depends on external network.
- No pagination beyond backend limit.

## Recommendations

Before scale:

1. Add pagination.
2. Add proper indexes for search/status/date.
3. Move migrations out of startup.
4. Consider CDN-hosted built admin bundle instead of external Vue CDN.
5. Replace in-memory rate limit for multi-instance deployment.
