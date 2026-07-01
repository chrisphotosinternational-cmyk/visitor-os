# VISITOR-OS
## Prompt 16 - Sprint 8
## Notification Engine

Implemented a central notification engine for email, internal alerts and webhooks.

Constraints:

- No CRM direct email sending.
- No OpenAI, booking, payment, WhatsApp or campaign features added.
- Resend is optional.
- Mock provider keeps local and V1 deployments usable without API keys.
- Queue is synchronous in V1 but abstracted for future BullMQ-style workers.
