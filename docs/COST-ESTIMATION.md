# Cost Estimation

Sprint 6 adds approximate AI cost estimation.

## Scope

The estimator is intentionally simple. It helps detect future cost risk without creating a billing
system.

It estimates:

- request cost;
- conversation cost;
- daily cost;
- monthly cost.

## Method

Tokens are estimated from text length when provider usage data is not available.

```text
estimated tokens = text length / 4
```

When a provider returns usage metadata, VISITOR-OS stores those values instead.

## Current Pricing

Pricing values are approximate and should be reviewed before production billing decisions.

Mock and Ollama are estimated at zero external API cost.

## Future Work

Before commercial launch, add:

- provider-specific pricing updates;
- per-organization monthly budgets;
- alert thresholds;
- detailed AI usage dashboard.
