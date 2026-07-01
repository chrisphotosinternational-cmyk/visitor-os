# CRM

Sprint 7 adds the advanced CRM foundation.

## Scope

The CRM remains simple and operational:

- prospect list;
- prospect filters;
- prospect detail;
- linked conversations;
- internal notes;
- follow-ups;
- status changes;
- tags;
- score history;
- filtered exports.

It does not include campaigns, payments, booking or advanced analytics.

## Statuses

- Nouveau
- A qualifier
- Interesse
- A rappeler
- Reservation probable
- Devis demande
- Client
- Perdu
- Archive

## Security

CRM routes reuse admin sessions, RBAC and organization isolation.

Users need:

- `prospects:read` to view CRM data;
- `prospects:write` to modify statuses, tags, notes and follow-ups;
- `data:export` to export filtered prospects.
