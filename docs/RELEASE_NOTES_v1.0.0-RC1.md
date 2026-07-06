# VISITOR-OS v1.0.0-RC1 Release Notes

## Purpose

This release candidate freezes the beta into a production-preparation milestone. It does not introduce a major business module; it focuses on auditability, UX stability, packaging and operational readiness.

## Highlights

- Project, security and UX audits.
- Admin `/system` page for health, DB, cache, queue, logs, uptime and metrics.
- Stronger keyboard focus and navigation state.
- RC1 version metadata.
- Administrator, user, installation, backup, troubleshooting and FAQ documentation.
- Windows/macOS installation helpers.
- Complete export/import script placeholders for controlled backup workflows.

## Known Limits

- Large CSV import is still synchronous.
- Admin UI should eventually move to a dedicated compiled frontend.
- Persistent queue is required before horizontal scaling.
- GitHub Actions workflow is not reintroduced in this sprint.

## Recommendation

GO for controlled RC1 validation.

