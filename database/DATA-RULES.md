# Data Rules

Status: conceptual rules, no executable schema yet.

## 1. Integrity Rules

- Tenant-owned records must include `organization_id`.
- Public widget requests must resolve to a valid site and organization.
- `site_configs` must be versioned; published versions should be immutable.
- A conversation must belong to one site.
- A message must belong to one conversation.
- A prospect can exist without email if another meaningful identifier or intent exists.
- A customer must originate from a prospect in V1.
- Export jobs must always be scoped to one organization.
- Privacy operations must be audited.
- Deleting a person must not break aggregate analytics.

## 2. CRM Rules

## Visitor

A visitor is a browser/session identity. It may be anonymous and should not be treated as a commercial contact by default.

## Prospect

A prospect is created when a visitor shows commercial intent or provides contact information.

Creation triggers:

- email provided;
- phone provided;
- request for quote, booking, price, availability, or call-back;
- manual user conversion from conversation;
- strong AI classification validated by rules.

## Customer

A customer is a converted prospect.

Conversion triggers:

- manual status change to `Client`;
- confirmed booking;
- accepted quote;
- payment received;
- imported customer confirmation later.

## Status Rules

Allowed minimum statuses:

- Nouveau
- A qualifier
- Interesse
- A rappeler
- Reservation probable
- Devis demande
- Client
- Perdu
- Archive

Rules:

- New prospects start as `Nouveau` or `A qualifier`.
- `Client` should create or update a customer record.
- `Archive` hides the prospect from active views but preserves history.
- `Perdu` remains reportable for conversion analytics.

## Duplicate Rules

- Normalize email before matching.
- Normalize phone before matching.
- Prefer exact email match over phone match.
- If both email and phone conflict, require manual review.
- Visitor-based matching is only a weak signal.
- Cross-organization merge is forbidden.
- Future merge operations must preserve a merge audit trail.

## Multiple Conversations

- One prospect can have many conversations.
- Anonymous conversations can later be attached to a prospect.
- Conversation source site remains unchanged after attachment.
- A person interacting with multiple sites in the same organization can be represented by one prospect with site-specific conversation history.

## 3. Scoring Rules

Score range: 0 to 100.

Current score:

- Stored on `prospects.score_current`.
- Updated from the latest accepted `lead_scores` record.

History:

- Every recalculation creates a `lead_scores` record.
- Each record stores score, previous score, reason, and criteria snapshot.

Suggested scoring criteria:

| Criterion | Effect |
|---|---:|
| Email provided | +10 |
| Phone provided | +15 |
| Price request | +8 |
| Availability request | +10 |
| Booking request | +20 |
| Date mentioned | +8 |
| Budget mentioned | +8 |
| Urgency detected | +10 |
| More than 3 meaningful messages | +5 |
| Returning visitor | +8 |
| Strong intent tag | +15 |
| Abandoned after strong intent | -10 |

Rules:

- Score must be explainable.
- Manual override should be audited in a future version.
- Recalculation can be triggered by new message, new tag, new contact info, follow-up outcome, or status change.
- Scoring must not be the only basis for automated commercial decisions.

## 4. Tag and Intent Rules

Tags may be:

- automatic;
- manual;
- system;
- organization-specific;
- site-specific;
- conversation-level;
- prospect-level.

Minimum system tags:

- Reservation
- Tarif
- Disponibilite
- Day Use
- Week-end
- Teletravail
- Festival
- Parking
- Petit-dejeuner
- Acces
- Decoration murale
- Shooting photo
- Studio photo
- Autre

Rules:

- System tags cannot be deleted by organizations.
- Custom tags should be archived instead of deleted if referenced.
- Automatic tags should store source and confidence.
- Manual tags should store creating user.
- Tags should not contain secrets or sensitive health/legal details unless a future privacy review allows it.

## 5. Conversation and Message Rules

- Conversations can start anonymously.
- Every conversation records site, source page, referrer, optional UTM, locale, device, browser, and site config version when available.
- Messages are append-only by default.
- RGPD deletion should redact or anonymize message content when needed.
- System and error events should be stored as conversation events, not mixed into user-visible message history unless useful.
- Prompt injection attempts are stored as user content but must not become system instructions.
- Fallback events should be created when the assistant cannot answer safely.

## 6. Configuration Rules

- Business-specific behavior belongs in `site_configs`, FAQs, tags, module settings, and knowledge content.
- Core engine code must not contain activity-specific rules.
- Configurations must be validated before publication.
- Published configurations should be immutable.
- Rollback means publishing a previous valid version, not editing history.
- Conversations should record the config version used.
- Public widget configuration must exclude private operational rules.

## 7. RGPD Rules

Consent records must include:

- purpose;
- status;
- source;
- timestamp;
- proof or proof reference;
- site and organization context.

Data export:

- Identity must be verified before sending personal data.
- Export files must expire.
- Export requests must be logged in `privacy_audit_logs`.

Deletion/anonymization:

- Prefer anonymization when aggregate analytics must remain intact.
- Remove or redact direct identifiers: name, email, phone, raw message content where required.
- Keep minimal privacy audit proof.
- Do not delete analytics snapshots if they are anonymous aggregates.

Retention:

- Visitors/page views: short to medium retention, then aggregate/purge.
- Prospects: retain while commercially relevant; archive inactive records.
- Customers: retain according to business/legal obligations.
- Export files: short retention, such as 7 to 30 days.
- Error logs: limited retention.
- Privacy audit logs: retain according to compliance policy.

## 8. Analytics Rules

V1 analytics should remain simple.

Track:

- conversations per day;
- prospects created;
- conversion rate;
- frequent tags;
- average score;
- site performance;
- frequent questions;
- fallbacks;
- estimated AI cost;
- notifications sent;
- overdue follow-ups.

Rules:

- Use source tables for early analytics where acceptable.
- Add `analytics_snapshots` for dashboard performance and stable historical metrics.
- Do not build a heavy analytics warehouse in V1.
- Preserve anonymous aggregate metrics after RGPD deletion.

## 9. Export Rules

Supported future formats:

- CSV in V1;
- XLSX later if needed.

Export metadata must include:

- requesting user;
- organization;
- export type;
- filters;
- status;
- row count;
- generated file;
- expiration date.

Minimum export columns:

- Date
- Site
- Activity
- First name
- Last name
- Email
- Phone
- Status
- Score
- Tags
- Last question
- Last answer
- Complete conversation
- Internal notes
- Follow-up date
- Source
- UTM

Rules:

- Exports require authorization.
- Exports must be audited.
- Generated files should expire.
- Do not expose export files through permanent public URLs.

## 10. Notification Rules

Notification triggers:

- new qualified prospect;
- hot prospect score threshold;
- follow-up due;
- follow-up overdue;
- notification send failure;
- important system error.

Rules:

- Store notification status.
- Store provider and minimal payload summary.
- Store provider error if sending fails.
- Avoid storing full email content where not needed.
- Prevent duplicate notifications with idempotency rules later.

## 11. Logs and Audit Rules

Use separate log types:

- `audit_logs`: admin/security actions.
- `error_logs`: important application failures.
- `privacy_audit_logs`: RGPD operations.
- `ai_events`: AI calls, cost, status, and summaries.

Rules:

- Logs must not contain secrets.
- Logs should avoid full personal payloads.
- Audit and privacy logs should be append-only.
- Error logs can have a resolution status.
- External monitoring can capture technical traces; database logs capture business traceability.

## 12. Multi-Tenant Rules

- The system may run as mono-organization in V1, but tables must be ready for multi-tenant usage.
- `organization_id` must be present on all tenant-owned entities.
- All queries must be scoped by organization.
- Site-level data must also respect organization ownership.
- Future plans may add subscription limits, user limits, module limits, and usage quotas.
