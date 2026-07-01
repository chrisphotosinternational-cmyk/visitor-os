# Providers

VISITOR-OS providers are adapters behind stable interfaces.

## Notification Providers

Current providers:

- `InternalProvider`: records internal alerts.
- `MockEmailProvider`: zero-cost local email simulation.
- `ResendEmailProvider`: real email sending through Resend.
- `WebhookProvider`: HTTP webhook delivery.

Prepared future providers:

- WhatsApp Business API
- SMS
- Push mobile
- Slack
- Discord
- Microsoft Teams

## Principle

CRM, exports, widget and AI modules must never call external communication providers directly. They emit typed notification requests only.

This keeps future provider changes low-risk and prevents notification logic from spreading through the codebase.
