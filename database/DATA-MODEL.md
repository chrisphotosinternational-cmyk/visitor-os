# VISITOR-OS Data Model

Status: conceptual model, no executable schema yet.

This document defines the business and data model for VISITOR-OS. It is intended to be detailed enough to generate a future PostgreSQL schema, while remaining independent from any ORM or migration tool.

## 1. Modeling Principles

- VISITOR-OS is a SaaS platform, not a single-business chatbot.
- The model must support one organization in V1 and multiple organizations later.
- Every business-specific behavior must come from configuration, tags, custom fields, or enabled modules.
- Core entities must include `organization_id` when tenant isolation is required.
- Visitors may remain anonymous.
- Prospects may be partial contacts without email.
- Customers are converted prospects, not a separate universe of data.
- RGPD operations must preserve aggregate analytics through anonymization where possible.
- Logs are separated by purpose: audit, privacy, AI, and technical errors.
- V1 should stay simple, but the model must avoid early dead ends.

## 2. Entity Families

## Core SaaS

### organizations

| Aspect | Description |
|---|---|
| Role | Represents a company, independent professional, or tenant using VISITOR-OS. |
| Business utility | Root container for sites, users, prospects, conversations, settings, modules, and billing later. |
| Main fields | `id`, `name`, `slug`, `status`, `plan_key`, `default_locale`, `timezone`, `created_at`, `updated_at`, `archived_at`. |
| Relations | Has many users, roles, sites, modules, settings, visitors, prospects, customers, conversations, logs, exports. |
| Cardinalities | One organization has many sites; one site belongs to one organization. |
| Integrity rules | `slug` unique; organization cannot be physically deleted before RGPD/data retention review. |
| Recommended indexes | `slug`, `status`, `plan_key`, `created_at`. |
| Sensitive data | Low to medium; company data may still be confidential. |
| Retention | Retain during contract; archive after cancellation; delete/anonymize according to contract and legal policy. |
| Risks | Cross-tenant data leakage if queries omit `organization_id`. |
| Future evolution | Subscription limits, billing, usage quotas, SSO, organization-level API keys. |

### users

| Aspect | Description |
|---|---|
| Role | Represents a dashboard user. |
| Business utility | Allows owners and team members to manage conversations, prospects, exports, and settings. |
| Main fields | `id`, `organization_id`, `email`, `password_hash`, `first_name`, `last_name`, `status`, `last_login_at`, `created_at`, `updated_at`, `disabled_at`. |
| Relations | Belongs to organization; assigned to roles; creates notes, exports, contact attempts, follow-ups. |
| Cardinalities | One organization has many users; one user may have many roles if role assignment is flexible. |
| Integrity rules | Email unique globally or unique per organization; disabled users cannot access dashboard. |
| Recommended indexes | `organization_id`, `email`, `status`, `last_login_at`. |
| Sensitive data | High; authentication and personal data. |
| Retention | Retain while account exists; anonymize or delete after account removal when allowed. |
| Risks | Account takeover, excessive permissions, stale users. |
| Future evolution | OAuth identities, MFA, invite workflow, SSO. |

### roles

| Aspect | Description |
|---|---|
| Role | Defines a named access profile. |
| Business utility | Supports owner/admin/member/read-only permissions as the product grows. |
| Main fields | `id`, `organization_id`, `key`, `name`, `description`, `is_system`, `created_at`, `updated_at`. |
| Relations | Has many permissions; assigned to users. |
| Cardinalities | One organization has many roles; one role can apply to many users. |
| Integrity rules | System roles cannot be deleted; role key unique per organization. |
| Recommended indexes | `organization_id`, `key`, `is_system`. |
| Sensitive data | Low. |
| Retention | Retain while organization exists. |
| Risks | Broken access control if permissions are too broad. |
| Future evolution | Module-level and site-level role scopes. |

### permissions

| Aspect | Description |
|---|---|
| Role | Defines atomic actions users may perform. |
| Business utility | Prevents all dashboard users from having unrestricted access. |
| Main fields | `id`, `key`, `module_key`, `description`, `created_at`. |
| Relations | Linked to roles through role-permission assignments. |
| Cardinalities | One permission can be attached to many roles. |
| Integrity rules | Permission keys are immutable once used. |
| Recommended indexes | `key`, `module_key`. |
| Sensitive data | Low. |
| Retention | Retain permanently as system reference data. |
| Risks | Permission sprawl and unclear authorization rules. |
| Future evolution | Granular scopes such as site, export, billing, AI, and privacy admin. |

### sites

| Aspect | Description |
|---|---|
| Role | Represents a website where the VISITOR-OS widget is installed. |
| Business utility | Supports multi-site organizations and activity-specific configurations. |
| Main fields | `id`, `organization_id`, `name`, `activity_key`, `domain`, `widget_public_key`, `status`, `default_locale`, `created_at`, `updated_at`, `archived_at`. |
| Relations | Belongs to organization; has many site configs, visitors, conversations, page views, traffic sources. |
| Cardinalities | One organization has many sites; one conversation belongs to one site. |
| Integrity rules | `widget_public_key` unique; domain allowed before widget accepts requests. |
| Recommended indexes | `organization_id`, `domain`, `widget_public_key`, `activity_key`, `status`. |
| Sensitive data | Medium; domain and configuration can reveal business strategy. |
| Retention | Retain while active; archive after removal; keep historical link for analytics unless RGPD requires otherwise. |
| Risks | Widget key leakage, wrong domain validation, cross-site configuration errors. |
| Future evolution | Multiple authorized domains, staging domain, custom widget versions. |

### site_configs

| Aspect | Description |
|---|---|
| Role | Versioned public and private configuration for a site. |
| Business utility | Makes the engine generic while adapting to each activity. |
| Main fields | `id`, `organization_id`, `site_id`, `version`, `status`, `brand_name`, `primary_color`, `secondary_color`, `welcome_message`, `fallback_message`, `quick_replies`, `business_facts`, `rules`, `contact`, `links`, `modules_enabled`, `published_at`, `created_at`, `created_by`. |
| Relations | Belongs to site; referenced by conversations and AI events as the config version used. |
| Cardinalities | One site has many config versions; only one published config should be active. |
| Integrity rules | Validate JSON structure before publish; immutable after publish except by creating a new version. |
| Recommended indexes | `organization_id`, `site_id`, `status`, `version`, `published_at`. |
| Sensitive data | Medium; may include contact details and business rules. |
| Retention | Keep config history for debugging; archive old versions after long retention period. |
| Risks | Invalid JSON, accidental exposure of private rules, poor rollback process. |
| Future evolution | Schema validation, preview mode, rollback, per-locale configuration. |

### modules

| Aspect | Description |
|---|---|
| Role | Catalog of optional product modules. |
| Business utility | Allows progressive activation of CRM, AI, exports, bookings, payments, documents, and future modules. |
| Main fields | `id`, `key`, `name`, `description`, `status`, `is_core`, `created_at`, `updated_at`. |
| Relations | Used by module settings and permissions. |
| Cardinalities | One module can be enabled for many organizations/sites. |
| Integrity rules | Core modules cannot be disabled globally if required by product operation. |
| Recommended indexes | `key`, `status`, `is_core`. |
| Sensitive data | Low. |
| Retention | System reference data; retain permanently. |
| Risks | Feature flags becoming inconsistent with data model. |
| Future evolution | Billing entitlements, module dependency graph. |

### module_settings

| Aspect | Description |
|---|---|
| Role | Stores organization-level or site-level module configuration. |
| Business utility | Enables modules without hardcoding business logic. |
| Main fields | `id`, `organization_id`, `site_id`, `module_id`, `enabled`, `settings`, `created_at`, `updated_at`. |
| Relations | Belongs to organization; optionally belongs to site; references module. |
| Cardinalities | One organization/site can have many module settings. |
| Integrity rules | Unique combination of organization, optional site, and module. |
| Recommended indexes | `organization_id`, `site_id`, `module_id`, `enabled`. |
| Sensitive data | Medium depending on settings. |
| Retention | Retain while module data exists; archive with organization. |
| Risks | Settings drift between organization and site scopes. |
| Future evolution | Module-level limits, billing, rollout flags. |

## Visitor & CRM

### visitors

| Aspect | Description |
|---|---|
| Role | Represents an anonymous or known website visitor identity. |
| Business utility | Links page views and conversations before the person becomes a prospect. |
| Main fields | `id`, `organization_id`, `site_id`, `anonymous_id`, `first_seen_at`, `last_seen_at`, `locale`, `device_type`, `browser`, `ip_hash`, `user_agent_summary`, `created_at`. |
| Relations | Has many page views, conversations, consents; may link to one or more prospects after identification. |
| Cardinalities | One visitor may have many conversations; one conversation has one visitor when known. |
| Integrity rules | Do not store raw IP unless legally justified; use hashed or truncated IP. |
| Recommended indexes | `organization_id`, `site_id`, `anonymous_id`, `last_seen_at`, `ip_hash`. |
| Sensitive data | Medium; anonymous behavioral data can still become personal data. |
| Retention | Shorter than CRM data; anonymize after retention period or deletion request. |
| Risks | Over-tracking, weak consent, fingerprinting concerns. |
| Future evolution | Cross-device merge with strict consent. |

### prospects

| Aspect | Description |
|---|---|
| Role | Represents a qualified or semi-qualified commercial contact. |
| Business utility | Central CRM object for follow-up, qualification, scoring, notes, tags, and conversion. |
| Main fields | `id`, `organization_id`, `site_id`, `visitor_id`, `first_name`, `last_name`, `email`, `phone`, `status`, `lifecycle_stage`, `source`, `score_current`, `consent_status`, `created_at`, `updated_at`, `archived_at`. |
| Relations | Has many conversations, notes, follow-ups, contact attempts, scores, tags; may become customer. |
| Cardinalities | One prospect can have many conversations; one conversation can be linked to one prospect. |
| Integrity rules | Email is optional; phone is optional; at least one useful identifier is required before commercial follow-up; consent required for commercial use. |
| Recommended indexes | `organization_id`, `site_id`, `email`, `phone`, `status`, `score_current`, `created_at`. |
| Sensitive data | High; contains personal and commercial intent data. |
| Retention | Retain according to CRM policy; archive inactive prospects; anonymize/delete on valid request. |
| Risks | Duplicates, contacting without consent, over-retention. |
| Future evolution | Custom fields, merge history, owner assignment, lifecycle automation. |

### customers

| Aspect | Description |
|---|---|
| Role | Represents a prospect who became a customer. |
| Business utility | Separates active commercial leads from converted clients while preserving history. |
| Main fields | `id`, `organization_id`, `prospect_id`, `customer_since`, `status`, `notes_summary`, `created_at`, `updated_at`. |
| Relations | Belongs to prospect; future link to bookings, invoices, quotes, documents, payments. |
| Cardinalities | One prospect may become one customer record. |
| Integrity rules | `prospect_id` unique; customer cannot exist without a source prospect in V1. |
| Recommended indexes | `organization_id`, `prospect_id`, `status`, `customer_since`. |
| Sensitive data | High. |
| Retention | Longer than prospects where legally justified by customer relationship. |
| Risks | Confusing lead status with actual customer relationship. |
| Future evolution | Separate billing profile, customer portal, contract history. |

### conversations

| Aspect | Description |
|---|---|
| Role | Represents one visitor interaction session. |
| Business utility | Stores the complete context that created or enriched a prospect. |
| Main fields | `id`, `organization_id`, `site_id`, `visitor_id`, `prospect_id`, `status`, `channel`, `started_at`, `ended_at`, `last_message_at`, `page_url`, `referrer`, `utm_source`, `utm_medium`, `utm_campaign`, `locale`, `device_type`, `browser`, `site_config_id`. |
| Relations | Has many messages, events, AI events, fallback events, tags; may link to prospect. |
| Cardinalities | One prospect can have many conversations; one conversation belongs to one site. |
| Integrity rules | Anonymous conversations allowed; prospect link can be added later; config version used must be recorded. |
| Recommended indexes | `organization_id`, `site_id`, `visitor_id`, `prospect_id`, `status`, `started_at`, `last_message_at`. |
| Sensitive data | High; message content may contain personal data. |
| Retention | Retain for CRM value; anonymize content if RGPD deletion applies while keeping aggregate stats. |
| Risks | Storing excessive personal data, losing context after config changes. |
| Future evolution | Human takeover, conversation assignment, channel expansion. |

### messages

| Aspect | Description |
|---|---|
| Role | Stores each message or system entry in a conversation. |
| Business utility | Provides full conversation history, quality review, extraction, and export. |
| Main fields | `id`, `organization_id`, `conversation_id`, `sender_type`, `content`, `content_format`, `metadata`, `created_at`, `redacted_at`. |
| Relations | Belongs to conversation; may reference AI event or fallback event. |
| Cardinalities | One conversation has many messages. |
| Integrity rules | Sender type constrained to visitor, assistant, user, system; redact rather than delete when audit requires history. |
| Recommended indexes | `organization_id`, `conversation_id`, `sender_type`, `created_at`. |
| Sensitive data | High. |
| Retention | Same as conversation; redact personal content for deletion requests. |
| Risks | Prompt injection content, personal data in free text, unsafe exports. |
| Future evolution | Attachments, message annotations, translation. |

### conversation_events

| Aspect | Description |
|---|---|
| Role | Records non-message events within a conversation. |
| Business utility | Tracks consent, fallback, lead capture, qualification steps, errors, page changes, and widget lifecycle. |
| Main fields | `id`, `organization_id`, `conversation_id`, `event_type`, `payload`, `created_at`. |
| Relations | Belongs to conversation. |
| Cardinalities | One conversation has many events. |
| Integrity rules | Event types must be controlled; payload must avoid secrets. |
| Recommended indexes | `organization_id`, `conversation_id`, `event_type`, `created_at`. |
| Sensitive data | Medium to high depending on payload. |
| Retention | Retain for debugging and analytics; anonymize personal payloads when required. |
| Risks | Unbounded event volume, sensitive data in payload. |
| Future evolution | Event-driven analytics pipeline. |

### lead_scores

| Aspect | Description |
|---|---|
| Role | Stores score history for prospects. |
| Business utility | Explains why a prospect is hot, warm, cold, or abandoned. |
| Main fields | `id`, `organization_id`, `prospect_id`, `score`, `previous_score`, `reason`, `criteria_snapshot`, `calculated_at`, `calculated_by`. |
| Relations | Belongs to prospect; can reference conversation. |
| Cardinalities | One prospect has many score records; prospect stores current score for fast access. |
| Integrity rules | Score between 0 and 100; current prospect score must match latest accepted score. |
| Recommended indexes | `organization_id`, `prospect_id`, `score`, `calculated_at`. |
| Sensitive data | Medium; reveals commercial interest. |
| Retention | Retain with prospect; anonymize with prospect. |
| Risks | Black-box scoring, unfair prioritization, stale score. |
| Future evolution | Configurable scoring profiles by activity. |

### intent_tags

| Aspect | Description |
|---|---|
| Role | Defines intent or topic tags usable by system, AI, users, and configuration. |
| Business utility | Classifies conversations and prospects without hardcoding business activities. |
| Main fields | `id`, `organization_id`, `site_id`, `key`, `label`, `category`, `source`, `is_system`, `created_at`, `updated_at`. |
| Relations | Applied to conversations and prospects; may be created by organization or system. |
| Cardinalities | One tag can apply to many conversations and prospects. |
| Integrity rules | Key unique per organization/site scope; system tags protected. |
| Recommended indexes | `organization_id`, `site_id`, `key`, `category`, `is_system`. |
| Sensitive data | Low unless labels reveal confidential strategy. |
| Retention | Retain while referenced; archive instead of deleting active tags. |
| Risks | Tag duplication, uncontrolled taxonomy. |
| Future evolution | Hierarchical tags, synonyms, AI confidence. |

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

### prospect_tags

| Aspect | Description |
|---|---|
| Role | Join entity between prospects and intent/custom tags. |
| Business utility | Allows manual, automatic, system, organization, site, conversation, and prospect-level tagging. |
| Main fields | `id`, `organization_id`, `prospect_id`, `intent_tag_id`, `source`, `confidence`, `created_by`, `created_at`. |
| Relations | Belongs to prospect and tag. |
| Cardinalities | One prospect has many tags; one tag applies to many prospects. |
| Integrity rules | Prevent exact duplicate active tags per prospect/source unless history is required. |
| Recommended indexes | `organization_id`, `prospect_id`, `intent_tag_id`, `source`. |
| Sensitive data | Medium; tags can reveal intent. |
| Retention | Retain with prospect; delete/anonymize with prospect. |
| Risks | Misclassification, too many tags. |
| Future evolution | Tag history and confidence review. |

### conversation_tags

| Aspect | Description |
|---|---|
| Role | Join entity between conversations and intent/custom tags. |
| Business utility | Classifies conversation topics independently from the final prospect record. |
| Main fields | `id`, `organization_id`, `conversation_id`, `intent_tag_id`, `source`, `confidence`, `created_by`, `created_at`. |
| Relations | Belongs to conversation and tag. |
| Cardinalities | One conversation has many tags; one tag applies to many conversations. |
| Integrity rules | Prevent duplicate active tags for the same conversation/tag/source combination. |
| Recommended indexes | `organization_id`, `conversation_id`, `intent_tag_id`, `source`, `created_at`. |
| Sensitive data | Medium; tags may reveal visitor intent. |
| Retention | Retain with conversation; anonymize or delete according to conversation privacy handling. |
| Risks | Misclassification, noisy automatic tagging. |
| Future evolution | AI confidence review and tag-to-FAQ improvement workflow. |

### internal_notes

| Aspect | Description |
|---|---|
| Role | Stores private notes added by dashboard users. |
| Business utility | Supports CRM follow-up and internal context. |
| Main fields | `id`, `organization_id`, `prospect_id`, `conversation_id`, `author_user_id`, `content`, `created_at`, `updated_at`, `deleted_at`. |
| Relations | Belongs to prospect or conversation; created by user. |
| Cardinalities | One prospect has many notes. |
| Integrity rules | Note must belong to at least one target; soft delete preferred. |
| Recommended indexes | `organization_id`, `prospect_id`, `conversation_id`, `author_user_id`, `created_at`. |
| Sensitive data | High; free text can contain personal data. |
| Retention | Retain with prospect/customer; redact on deletion request if needed. |
| Risks | Users writing sensitive or unlawful data. |
| Future evolution | Mentions, attachments, note types. |

### follow_ups

| Aspect | Description |
|---|---|
| Role | Represents a planned reminder or next action. |
| Business utility | Prevents lost leads. |
| Main fields | `id`, `organization_id`, `prospect_id`, `assigned_user_id`, `due_at`, `status`, `priority`, `reason`, `completed_at`, `created_at`, `updated_at`. |
| Relations | Belongs to prospect; optionally assigned to user; may create notification events. |
| Cardinalities | One prospect can have many follow-ups. |
| Integrity rules | Due date required; closed follow-up requires completion timestamp. |
| Recommended indexes | `organization_id`, `prospect_id`, `assigned_user_id`, `status`, `due_at`. |
| Sensitive data | Medium. |
| Retention | Retain with prospect; delete/anonymize with prospect. |
| Risks | Overdue tasks not surfaced, duplicate reminders. |
| Future evolution | Calendar sync, automation rules. |

### contact_attempts

| Aspect | Description |
|---|---|
| Role | Tracks attempts to contact a prospect. |
| Business utility | Gives follow-up history and avoids repeated uncoordinated contact. |
| Main fields | `id`, `organization_id`, `prospect_id`, `user_id`, `channel`, `status`, `summary`, `attempted_at`, `next_step`. |
| Relations | Belongs to prospect and optional user. |
| Cardinalities | One prospect has many contact attempts. |
| Integrity rules | Channel and status must be controlled values. |
| Recommended indexes | `organization_id`, `prospect_id`, `channel`, `status`, `attempted_at`. |
| Sensitive data | High. |
| Retention | Retain with prospect/customer; anonymize on request. |
| Risks | Inaccurate contact history, consent violations. |
| Future evolution | Email/phone integration, outcome analytics. |

## AI & Knowledge

### knowledge_bases

| Aspect | Description |
|---|---|
| Role | Groups knowledge content for an organization or site. |
| Business utility | Provides controlled local context for AI responses. |
| Main fields | `id`, `organization_id`, `site_id`, `name`, `status`, `locale`, `created_at`, `updated_at`. |
| Relations | Has many knowledge items and FAQs. |
| Cardinalities | One site can have many knowledge bases. |
| Integrity rules | Only active/validated knowledge should be used for production answers. |
| Recommended indexes | `organization_id`, `site_id`, `status`, `locale`. |
| Sensitive data | Medium; may include business content. |
| Retention | Retain version history while useful; archive obsolete content. |
| Risks | Outdated information causing wrong answers. |
| Future evolution | Embeddings, document imports, per-module knowledge. |

### knowledge_items

| Aspect | Description |
|---|---|
| Role | Stores individual knowledge entries or future document chunks. |
| Business utility | Supports AI grounding and FAQ-like responses. |
| Main fields | `id`, `organization_id`, `knowledge_base_id`, `title`, `content`, `source_type`, `source_url`, `status`, `version`, `metadata`, `created_at`, `updated_at`. |
| Relations | Belongs to knowledge base; may be used by AI events. |
| Cardinalities | One knowledge base has many items. |
| Integrity rules | Content must be validated before AI use; version old items instead of overwriting critical content. |
| Recommended indexes | `organization_id`, `knowledge_base_id`, `status`, `source_type`, `updated_at`. |
| Sensitive data | Medium to high depending on imported documents. |
| Retention | Retain active content; archive old versions; delete confidential obsolete content if required. |
| Risks | Hallucination if stale, leaking private documents. |
| Future evolution | Vector index reference, chunking, citations. |

### faqs

| Aspect | Description |
|---|---|
| Role | Stores curated question/answer pairs. |
| Business utility | Reduces AI cost and hallucination risk. |
| Main fields | `id`, `organization_id`, `site_id`, `question`, `answer`, `tags`, `status`, `locale`, `priority`, `created_at`, `updated_at`. |
| Relations | Belongs to site or organization; can link to knowledge base. |
| Cardinalities | One site has many FAQs. |
| Integrity rules | Only approved FAQs used in production; answer should not include unsupported claims. |
| Recommended indexes | `organization_id`, `site_id`, `status`, `locale`, `priority`. |
| Sensitive data | Low to medium. |
| Retention | Retain active and archived versions for answer history. |
| Risks | Wrong or outdated public answers. |
| Future evolution | FAQ analytics, suggested FAQ from conversations. |

### prompt_templates

| Aspect | Description |
|---|---|
| Role | Stores versioned prompt instructions for AI tasks. |
| Business utility | Controls assistant behavior across activities without changing code. |
| Main fields | `id`, `organization_id`, `site_id`, `key`, `name`, `template`, `version`, `status`, `created_at`, `published_at`. |
| Relations | Referenced by AI events. |
| Cardinalities | One site can have many prompt templates and versions. |
| Integrity rules | Published templates immutable; no secrets in prompts. |
| Recommended indexes | `organization_id`, `site_id`, `key`, `status`, `version`. |
| Sensitive data | Medium; prompts may include business strategy. |
| Retention | Keep versions for traceability. |
| Risks | Prompt injection, unsafe instructions, hallucination. |
| Future evolution | A/B tests, task-specific prompts. |

### ai_events

| Aspect | Description |
|---|---|
| Role | Records AI calls and outcomes. |
| Business utility | Enables debugging, cost tracking, quality review, and hallucination reduction. |
| Main fields | `id`, `organization_id`, `conversation_id`, `message_id`, `task_type`, `provider`, `model`, `prompt_template_id`, `input_summary`, `output_summary`, `tokens_input`, `tokens_output`, `estimated_cost`, `status`, `error_code`, `created_at`. |
| Relations | Belongs to conversation; may reference message and prompt template. |
| Cardinalities | One conversation has many AI events. |
| Integrity rules | Do not store full sensitive prompts unless explicitly allowed; summarize or redact when possible. |
| Recommended indexes | `organization_id`, `conversation_id`, `task_type`, `provider`, `model`, `created_at`, `status`. |
| Sensitive data | High if raw content is stored. |
| Retention | Retain summaries and cost data; redact personal inputs where possible. |
| Risks | Leaking personal data to logs, cost overruns. |
| Future evolution | Quality ratings, citation tracking, model comparison. |

### fallback_events

| Aspect | Description |
|---|---|
| Role | Records when the assistant could not safely answer. |
| Business utility | Identifies missing FAQ/content and prevents hallucination. |
| Main fields | `id`, `organization_id`, `site_id`, `conversation_id`, `message_id`, `reason`, `user_question`, `fallback_message`, `created_at`, `resolved_at`. |
| Relations | Belongs to conversation/message; can lead to FAQ creation. |
| Cardinalities | One conversation can have many fallback events. |
| Integrity rules | Redact personal data from stored question if needed. |
| Recommended indexes | `organization_id`, `site_id`, `reason`, `created_at`, `resolved_at`. |
| Sensitive data | Medium to high. |
| Retention | Retain for improvement; anonymize on request. |
| Risks | Storing sensitive free text in unresolved events. |
| Future evolution | FAQ suggestion workflow. |

## Tracking & Analytics

### page_views

| Aspect | Description |
|---|---|
| Role | Stores widget-related page view events. |
| Business utility | Measures where conversations and leads originate. |
| Main fields | `id`, `organization_id`, `site_id`, `visitor_id`, `url`, `title`, `referrer`, `occurred_at`, `device_type`, `browser`, `utm_source`, `utm_medium`, `utm_campaign`. |
| Relations | Belongs to visitor and site. |
| Cardinalities | One visitor has many page views. |
| Integrity rules | Track only necessary data; avoid full fingerprinting. |
| Recommended indexes | `organization_id`, `site_id`, `visitor_id`, `occurred_at`, `utm_source`. |
| Sensitive data | Medium. |
| Retention | Short to medium; aggregate then purge detailed events. |
| Risks | Excessive tracking without consent. |
| Future evolution | Aggregated analytics warehouse if volume grows. |

### traffic_sources

| Aspect | Description |
|---|---|
| Role | Normalizes traffic source attribution. |
| Business utility | Helps compare source performance. |
| Main fields | `id`, `organization_id`, `site_id`, `visitor_id`, `conversation_id`, `source`, `medium`, `campaign`, `referrer_domain`, `landing_url`, `created_at`. |
| Relations | Links visitor/conversation/site. |
| Cardinalities | One conversation has zero or one primary traffic source. |
| Integrity rules | Source values normalized when possible. |
| Recommended indexes | `organization_id`, `site_id`, `source`, `medium`, `campaign`, `created_at`. |
| Sensitive data | Low to medium. |
| Retention | Aggregate over time; delete detailed data after retention period. |
| Risks | Misattribution. |
| Future evolution | Multi-touch attribution. |

### utm_events

| Aspect | Description |
|---|---|
| Role | Stores raw UTM capture events. |
| Business utility | Preserves campaign information for reporting and exports. |
| Main fields | `id`, `organization_id`, `site_id`, `visitor_id`, `utm_source`, `utm_medium`, `utm_campaign`, `utm_term`, `utm_content`, `url`, `captured_at`. |
| Relations | Belongs to visitor/site. |
| Cardinalities | One visitor can have many UTM events. |
| Integrity rules | Empty UTM events should not be stored. |
| Recommended indexes | `organization_id`, `site_id`, `visitor_id`, `utm_source`, `captured_at`. |
| Sensitive data | Low. |
| Retention | Aggregate and purge detailed events after analytics period. |
| Risks | High volume without value. |
| Future evolution | Campaign performance dashboards. |

### conversion_events

| Aspect | Description |
|---|---|
| Role | Records important funnel conversions. |
| Business utility | Measures lead creation, booking intent, quote request, customer conversion. |
| Main fields | `id`, `organization_id`, `site_id`, `visitor_id`, `prospect_id`, `conversation_id`, `event_type`, `value`, `occurred_at`, `metadata`. |
| Relations | Links to visitor/prospect/conversation/site. |
| Cardinalities | One prospect can have many conversion events. |
| Integrity rules | Event types controlled; avoid duplicate conversion events for same action. |
| Recommended indexes | `organization_id`, `site_id`, `event_type`, `occurred_at`, `prospect_id`. |
| Sensitive data | Medium. |
| Retention | Retain aggregate stats long term; anonymize person links on deletion. |
| Risks | Inflated metrics from duplicates. |
| Future evolution | Revenue attribution. |

### analytics_snapshots

| Aspect | Description |
|---|---|
| Role | Stores precomputed metrics by period. |
| Business utility | Keeps dashboards fast without heavy analytics in V1. |
| Main fields | `id`, `organization_id`, `site_id`, `period_type`, `period_start`, `period_end`, `metrics`, `created_at`. |
| Relations | Aggregates data from conversations, prospects, scores, fallbacks, notifications. |
| Cardinalities | One site has many period snapshots. |
| Integrity rules | Unique snapshot per organization/site/period; metrics must be reproducible. |
| Recommended indexes | `organization_id`, `site_id`, `period_type`, `period_start`. |
| Sensitive data | Low if aggregated. |
| Retention | Long-term retention acceptable if anonymized/aggregated. |
| Risks | Snapshot drift from source data. |
| Future evolution | Dedicated analytics store if volume grows. |

## Notifications

### notification_events

| Aspect | Description |
|---|---|
| Role | Records notification requests generated by the system. |
| Business utility | Tracks alerts for hot prospects, follow-ups, errors, and admin events. |
| Main fields | `id`, `organization_id`, `site_id`, `type`, `channel`, `recipient`, `status`, `payload_summary`, `created_at`, `sent_at`, `failed_at`. |
| Relations | May reference prospect, conversation, follow-up, or error log. |
| Cardinalities | One prospect/follow-up can create many notification events. |
| Integrity rules | Payload must not store unnecessary personal data; status controlled. |
| Recommended indexes | `organization_id`, `site_id`, `type`, `status`, `created_at`. |
| Sensitive data | Medium to high depending on recipient and payload. |
| Retention | Retain delivery history for support; purge detailed payloads after short period. |
| Risks | Duplicate notifications, private data in payload. |
| Future evolution | User notification preferences and webhooks. |

### email_events

| Aspect | Description |
|---|---|
| Role | Records provider-level email send results. |
| Business utility | Diagnoses delivery problems and confirms system emails. |
| Main fields | `id`, `organization_id`, `notification_event_id`, `provider`, `provider_message_id`, `to_address_hash`, `template_key`, `status`, `error_message`, `sent_at`, `delivered_at`, `opened_at`, `created_at`. |
| Relations | Belongs to notification event. |
| Cardinalities | One notification event can have one or more email attempts. |
| Integrity rules | Store hashed recipient where possible; avoid full email body. |
| Recommended indexes | `organization_id`, `notification_event_id`, `provider_message_id`, `status`, `created_at`. |
| Sensitive data | Medium. |
| Retention | Retain limited delivery history; purge provider payloads. |
| Risks | Leaking recipient addresses and message content. |
| Future evolution | Bounce handling, unsubscribe rules where applicable. |

## Exports

### export_jobs

| Aspect | Description |
|---|---|
| Role | Tracks export requests. |
| Business utility | Provides CSV/XLSX exports with traceability. |
| Main fields | `id`, `organization_id`, `requested_by_user_id`, `export_type`, `status`, `filters`, `format`, `row_count`, `started_at`, `completed_at`, `failed_at`, `error_message`. |
| Relations | Created by user; may create export file and audit log. |
| Cardinalities | One user can create many export jobs. |
| Integrity rules | Authorization required; filters stored for audit; export scoped to organization. |
| Recommended indexes | `organization_id`, `requested_by_user_id`, `export_type`, `status`, `created_at`. |
| Sensitive data | High. |
| Retention | Keep job metadata; expire generated files quickly. |
| Risks | Excessive export of personal data, unauthorized access. |
| Future evolution | Background workers and scheduled exports. |

### export_files

| Aspect | Description |
|---|---|
| Role | Represents generated export files. |
| Business utility | Allows download history and file expiration. |
| Main fields | `id`, `organization_id`, `export_job_id`, `storage_provider`, `file_path`, `file_name`, `mime_type`, `size_bytes`, `expires_at`, `downloaded_at`, `created_at`. |
| Relations | Belongs to export job. |
| Cardinalities | One export job can produce one or more files. |
| Integrity rules | Files must expire; access requires authorization; avoid public permanent URLs. |
| Recommended indexes | `organization_id`, `export_job_id`, `expires_at`, `created_at`. |
| Sensitive data | High. |
| Retention | Short retention, such as 7 to 30 days; delete expired files. |
| Risks | Public exposure of exports. |
| Future evolution | S3/R2 storage and encrypted file handling. |

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

## RGPD / Privacy

### consents

| Aspect | Description |
|---|---|
| Role | Records consent decisions. |
| Business utility | Proves permission for data collection and commercial follow-up. |
| Main fields | `id`, `organization_id`, `site_id`, `visitor_id`, `prospect_id`, `purpose`, `status`, `source`, `proof_payload`, `given_at`, `withdrawn_at`, `created_at`. |
| Relations | Links to visitor/prospect/site. |
| Cardinalities | One visitor/prospect can have many consent records by purpose. |
| Integrity rules | Purpose required; newest consent status determines current permission. |
| Recommended indexes | `organization_id`, `site_id`, `visitor_id`, `prospect_id`, `purpose`, `given_at`. |
| Sensitive data | High. |
| Retention | Retain proof as long as legally needed, even after withdrawal. |
| Risks | Missing proof, unclear purpose, outdated consent. |
| Future evolution | Consent banner versions and legal text versions. |

### data_export_requests

| Aspect | Description |
|---|---|
| Role | Tracks personal data export requests. |
| Business utility | Supports RGPD access rights. |
| Main fields | `id`, `organization_id`, `requester_email`, `prospect_id`, `visitor_id`, `status`, `verification_status`, `requested_at`, `completed_at`, `expires_at`. |
| Relations | May link to prospect/visitor and export files. |
| Cardinalities | One person can make multiple requests. |
| Integrity rules | Identity verification required before disclosure. |
| Recommended indexes | `organization_id`, `requester_email`, `status`, `requested_at`. |
| Sensitive data | High. |
| Retention | Keep request audit metadata; expire files quickly. |
| Risks | Sending personal data to wrong person. |
| Future evolution | Self-service privacy portal. |

### deletion_requests

| Aspect | Description |
|---|---|
| Role | Tracks deletion or anonymization requests. |
| Business utility | Supports right to erasure without breaking aggregate statistics. |
| Main fields | `id`, `organization_id`, `requester_email`, `prospect_id`, `visitor_id`, `status`, `scope`, `method`, `requested_at`, `completed_at`, `reason`. |
| Relations | Links to privacy audit logs and affected records. |
| Cardinalities | One person can have multiple deletion requests. |
| Integrity rules | Verify identity; prefer anonymization for analytics when legally acceptable. |
| Recommended indexes | `organization_id`, `requester_email`, `status`, `requested_at`, `completed_at`. |
| Sensitive data | High. |
| Retention | Keep minimal audit proof after completion. |
| Risks | Deleting too much, failing to delete enough, breaking reports. |
| Future evolution | Automated deletion workflows. |

### privacy_audit_logs

| Aspect | Description |
|---|---|
| Role | Immutable privacy action log. |
| Business utility | Proves data access, export, anonymization, deletion, and consent changes. |
| Main fields | `id`, `organization_id`, `actor_type`, `actor_id`, `action`, `target_type`, `target_id`, `request_id`, `summary`, `created_at`. |
| Relations | May reference data export or deletion request. |
| Cardinalities | One request can create many privacy audit logs. |
| Integrity rules | Append-only; no sensitive full payloads. |
| Recommended indexes | `organization_id`, `action`, `target_type`, `target_id`, `created_at`. |
| Sensitive data | Medium. |
| Retention | Retain according to legal audit policy. |
| Risks | Audit log containing too much personal data. |
| Future evolution | Tamper-evident logs. |

## System

### app_settings

| Aspect | Description |
|---|---|
| Role | Stores global or organization-scoped settings. |
| Business utility | Allows controlled operational configuration. |
| Main fields | `id`, `organization_id`, `key`, `value`, `scope`, `created_at`, `updated_at`. |
| Relations | Optional organization scope. |
| Cardinalities | One organization can have many app settings. |
| Integrity rules | Key unique per scope; sensitive settings should use secret management, not this table. |
| Recommended indexes | `organization_id`, `key`, `scope`. |
| Sensitive data | Low to high depending on value; avoid secrets. |
| Retention | Retain while active. |
| Risks | Accidentally storing secrets. |
| Future evolution | Typed settings and validation schemas. |

### audit_logs

| Aspect | Description |
|---|---|
| Role | Records administrative and security-relevant actions. |
| Business utility | Supports accountability and debugging. |
| Main fields | `id`, `organization_id`, `actor_user_id`, `action`, `target_type`, `target_id`, `ip_hash`, `user_agent_summary`, `metadata`, `created_at`. |
| Relations | May reference user and target entities. |
| Cardinalities | One user can create many audit logs. |
| Integrity rules | Append-only; metadata must avoid secrets. |
| Recommended indexes | `organization_id`, `actor_user_id`, `action`, `target_type`, `target_id`, `created_at`. |
| Sensitive data | Medium. |
| Retention | Retain for security policy period. |
| Risks | Missing critical admin actions. |
| Future evolution | Exportable audit trail for enterprise plans. |

### error_logs

| Aspect | Description |
|---|---|
| Role | Stores important application errors not covered by external monitoring. |
| Business utility | Gives local traceability for failures, especially exports, notifications, and AI tasks. |
| Main fields | `id`, `organization_id`, `site_id`, `severity`, `source`, `message`, `code`, `context`, `occurred_at`, `resolved_at`. |
| Relations | May reference conversation, export, notification, or AI event. |
| Cardinalities | One source entity can have many errors. |
| Integrity rules | Do not store secrets or full personal payloads. |
| Recommended indexes | `organization_id`, `site_id`, `severity`, `source`, `occurred_at`, `resolved_at`. |
| Sensitive data | Medium depending on context. |
| Retention | Keep limited retention; Sentry handles detailed technical traces. |
| Risks | Log noise, sensitive payload exposure. |
| Future evolution | Incident management. |

### webhooks

| Aspect | Description |
|---|---|
| Role | Stores future outgoing webhook configuration. |
| Business utility | Allows integration with external tools once product value is proven. |
| Main fields | `id`, `organization_id`, `site_id`, `name`, `url`, `events`, `status`, `secret_reference`, `created_at`, `updated_at`. |
| Relations | Belongs to organization/site; produces notification or delivery events later. |
| Cardinalities | One organization can have many webhooks. |
| Integrity rules | Secret values stored securely outside table or encrypted; URL validation required. |
| Recommended indexes | `organization_id`, `site_id`, `status`. |
| Sensitive data | High if secrets stored incorrectly. |
| Retention | Retain while active; delete disabled secrets. |
| Risks | SSRF, secret leakage, retry storms. |
| Future evolution | Webhook deliveries table and retry policy. |

## Future Modules

Future module entities should stay inactive until product-market fit or confirmed user need.

| Entity | Role | Key relationships | Main caution |
|---|---|---|---|
| bookings | Reservation or appointment record. | Organization, site, prospect/customer, calendar event. | Do not confirm bookings without availability logic. |
| payments | Payment intent or transaction reference. | Customer, invoice, booking, provider event. | Never store card data directly. |
| invoices | Billing document issued to customer. | Customer, payment, quote. | Legal numbering and retention rules. |
| quotes | Commercial proposal. | Prospect/customer, documents, invoice later. | Versioning and acceptance history. |
| documents | Uploaded or generated files. | Organization, prospect/customer, knowledge base. | Storage, privacy, retention. |
| calendar_events | Appointment or reminder on calendar. | Booking, follow-up, user. | Timezone handling. |
| automations | Configured trigger/action workflows. | Organization, modules, events. | Avoid building a complex workflow engine too early. |

## 3. CRM Lifecycle Rules

## Visitor, Prospect, Customer

- A visitor is an anonymous or semi-anonymous browser identity.
- A prospect is a visitor or contact with commercial relevance.
- A customer is a prospect that has completed a business outcome such as booking, purchase, signed quote, or confirmed service.

## Visitor Becomes Prospect When

- The visitor provides email or phone.
- The visitor explicitly asks to be contacted.
- The visitor requests price, booking, quote, availability, or service information with enough context.
- The system or user marks the conversation as commercially relevant.

## Prospect Becomes Customer When

- A booking is confirmed.
- A quote is accepted.
- A payment is received.
- A manual admin action marks the person as customer.

## Minimum Prospect Statuses

- Nouveau
- A qualifier
- Interesse
- A rappeler
- Reservation probable
- Devis demande
- Client
- Perdu
- Archive

## Duplicate Handling

- Match by normalized email when available.
- Match by normalized phone when available.
- If no direct identifier exists, use visitor identity plus site and recent time window.
- Never auto-merge high-risk records without user review.
- Keep a merge audit trail in future versions.

## Prospect Without Email

- Allow phone-only or name-only prospects.
- Mark contactability level.
- Avoid commercial email workflows until email consent exists.

## Multiple Conversations

- A prospect can have many conversations across time.
- A visitor can have anonymous conversations before being linked to a prospect.
- When identity is captured, future and eligible past conversations can be linked.

## Multiple Sites

- A person can interact with multiple sites from the same organization.
- Keep site attribution at conversation and prospect source level.
- Do not merge across organizations.

## 4. Scoring Model

VISITOR-OS uses a 0 to 100 score.

| Factor | Suggested effect |
|---|---:|
| Email provided | +10 |
| Phone provided | +15 |
| Price request | +8 |
| Availability request | +10 |
| Booking request | +20 |
| Date mentioned | +8 |
| Budget mentioned | +8 |
| Urgency | +10 |
| More than 3 meaningful messages | +5 |
| Returning visitor/conversation | +8 |
| Strong intent tag | +15 |
| Abandoned conversation after strong intent | -10 |

Rules:

- Score must remain between 0 and 100.
- `prospects.score_current` stores the latest accepted score.
- `lead_scores` stores score history and justification.
- Recalculation should be triggered by new messages, new contact details, tag changes, or manual admin action.
- Score must be explainable through `reason` and `criteria_snapshot`.
- Scoring rules should become configurable per organization or activity later.
