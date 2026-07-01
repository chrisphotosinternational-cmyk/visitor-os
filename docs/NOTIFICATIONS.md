# Notification Engine

Sprint 8 introduces a central Notification Engine for VISITOR-OS.

The rule is simple: business modules never send emails, webhooks or alerts directly. They call the Notification Engine with a typed event. The engine resolves templates, settings, providers, retries and history.

## Scope V1

- Internal notifications.
- Email notifications through Resend when configured.
- Email mock provider when no API key is configured.
- Webhook provider.
- Notification history in PostgreSQL.
- Organization-level notification settings.
- Synchronous queue abstraction ready for a future worker.

## Notification Types

- `hot_prospect`
- `new_conversation`
- `potential_booking`
- `follow_up_today`
- `follow_up_overdue`
- `system_error`
- `ai_provider_unavailable`
- `export_completed`
- `new_organization`
- `new_site`

## Trigger Sources

The engine can be called from:

- Decision Engine
- CRM
- AI Engine
- Business Configuration Engine
- Authentication
- Exports

Current Sprint 8 wiring covers widget conversation events, hot prospects, potential bookings, follow-ups, exports, organization creation, site creation and AI provider unavailability.

## Queue Strategy

The current implementation is synchronous. It is intentionally hidden behind a queue interface so VISITOR-OS can later move to BullMQ, Redis or another queue without changing CRM or widget code.

## Security

- Secrets are read from environment variables or organization settings.
- Provider errors are recorded without storing full sensitive message bodies.
- Notification history stores a short content preview only.
- Admin routes require `settings:access`.
- Data is filtered by organization access control.
