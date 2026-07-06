# VISITOR-OS QA Checklist - v1.0.0-RC1

## Backend

- [ ] `/live` returns 200.
- [ ] `/health` returns runtime details.
- [ ] `/ready` returns DB state.
- [ ] `/metrics` returns text metrics.

## Frontend

- [ ] Login page loads at `/`.
- [ ] Dashboard loads after login.
- [ ] `/system` displays health and metrics.
- [ ] Keyboard focus is visible.
- [ ] Mobile layout remains usable.

## Import/Export

- [ ] 100-row dirty CSV import succeeds.
- [ ] 5,000-row dirty CSV import succeeds.
- [ ] Rejected rows are reported.
- [ ] CSV export downloads.

## CRM/Pipeline

- [ ] Prospect CRUD works.
- [ ] Follow-ups work.
- [ ] Pipeline movement works.
- [ ] Dashboard metrics update.

## AI/Enrichment

- [ ] Mock AI works without external key.
- [ ] Public enrichment handles success, partial, blocked and failed states.
- [ ] Suggestions require manual accept/reject.

## Permissions

- [ ] Viewer cannot mutate data.
- [ ] Admin is limited to own organization.
- [ ] SuperAdmin can access all organizations.

## Production

- [ ] Backup completed.
- [ ] Restore tested on disposable environment.
- [ ] Logs reviewed.
- [ ] Known limitations accepted.

