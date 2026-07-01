# Webhooks

Webhook delivery is available through the Notification Engine.

## Configuration

Each organization can define:

- URL
- headers
- secret
- timeout
- retry attempts

## Request

The webhook provider sends a JSON payload containing:

- subject
- title
- content

If a secret is configured, it is sent in `X-Visitor-OS-Secret`.

## Reliability

V1 uses synchronous retries. The queue abstraction is ready for asynchronous retries in a future sprint.

## Security

- Do not hardcode secrets.
- Do not log webhook secrets.
- Do not put sensitive personal data in webhook URLs.
- Prefer HTTPS URLs.
