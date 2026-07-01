# Emails

Email delivery is handled only by the Notification Engine.

## Providers

V1 supports:

- `mock`: default, no external API call.
- `resend`: active when `RESEND_API_KEY` is configured.

## Environment

```bash
RESEND_API_KEY=
NOTIFICATION_FROM_EMAIL=notifications@visitor-os.local
NOTIFICATION_RETRY_ATTEMPTS=2
NOTIFICATION_TIMEOUT_MS=5000
```

The application must work without `RESEND_API_KEY`. In that case email notifications are recorded as sent by the mock provider.

## Recipients

Each organization can configure administrator emails in the admin panel. If no email is configured, internal notifications still work.

## Future

Future email work should add:

- HTML templates.
- Per-language templates.
- Unsubscribe/preferences if end-user emails are introduced.
- Provider delivery IDs.
