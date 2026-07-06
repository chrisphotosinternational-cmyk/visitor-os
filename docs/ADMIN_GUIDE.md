# VISITOR-OS Administrator Guide - v1.0.0-RC1

## Daily Entry Points

- `/` opens the protected admin application.
- `/system` shows runtime health, queue, cache, logs, DB state and metrics.
- `/prospects` manages CRM records.
- `/pipeline` manages commercial progression.
- `/follow-ups` lists manual relances.
- `/settings` manages feature flags and runtime settings.

## Recommended Daily Routine

1. Check `/system` for API, DB and queue status.
2. Review dashboard alerts and pipeline counts.
3. Process overdue follow-ups.
4. Import or update prospects.
5. Use message templates manually, then record the interaction.
6. Review enrichment suggestions before accepting them.

## Roles

- SuperAdmin: full cross-organization access.
- Admin: organization-level administration.
- Manager: operational management.
- Agent: CRM and follow-up execution.
- Viewer: read-only access.

## Production Rules

- Never store real secrets in the repository.
- Do not enable external AI or email providers without keys and cost controls.
- Export data only when necessary.
- Use backups before migrations or large imports.

