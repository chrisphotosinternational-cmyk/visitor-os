# Entity Relationships

Status: conceptual model, no executable schema yet.

This document describes the main relationships and cardinalities in VISITOR-OS.

## 1. High-Level Text Diagram

```text
organizations
  1 -> N users
  1 -> N roles
  1 -> N sites
  1 -> N modules/module_settings
  1 -> N visitors
  1 -> N prospects
  1 -> N customers
  1 -> N conversations
  1 -> N exports/logs/privacy records

sites
  1 -> N site_configs
  1 -> N visitors
  1 -> N conversations
  1 -> N page_views
  1 -> N faqs/knowledge_bases

visitors
  1 -> N page_views
  1 -> N conversations
  1 -> N consents
  0..N -> 0..N prospects through identity resolution

prospects
  1 -> N conversations
  1 -> N lead_scores
  1 -> N prospect_tags
  1 -> N internal_notes
  1 -> N follow_ups
  1 -> N contact_attempts
  0..1 -> 1 customers

conversations
  1 -> N messages
  1 -> N conversation_events
  1 -> N ai_events
  1 -> N fallback_events
  1 -> N conversation_tags

knowledge_bases
  1 -> N knowledge_items
  1 -> N faqs

export_jobs
  1 -> N export_files
```

## 2. Core SaaS Relationships

| From | To | Cardinality | Notes |
|---|---|---|---|
| organization | users | 1:N | Users are scoped to an organization in V1. |
| organization | roles | 1:N | System roles may be copied per organization or globally referenced. |
| roles | permissions | N:N | Implement through a role-permission assignment table later. |
| users | roles | N:N | Allows future multi-role users. V1 may restrict to one role. |
| organization | sites | 1:N | Enables multi-site organizations. |
| site | site_configs | 1:N | Versioned configuration; one published config active. |
| modules | module_settings | 1:N | Settings enable modules by organization/site. |
| organization | module_settings | 1:N | Organization-level module state. |
| site | module_settings | 0..1:N | Site override when needed. |

## 3. Visitor and CRM Relationships

| From | To | Cardinality | Notes |
|---|---|---|---|
| organization | visitors | 1:N | Tenant isolation. |
| site | visitors | 1:N | First-party site context. |
| visitor | conversations | 1:N | Anonymous sessions are allowed. |
| visitor | prospects | 0..N | Multiple prospects are possible only when identity resolution is uncertain; avoid auto-merge. |
| prospect | conversations | 1:N | Conversations can be linked after identification. |
| prospect | customer | 0..1:1 | One customer record per converted prospect in V1. |
| prospect | internal_notes | 1:N | Notes are private and organization-scoped. |
| conversation | internal_notes | 1:N | Notes may also target a specific conversation. |
| prospect | follow_ups | 1:N | Follow-up tasks are CRM actions. |
| prospect | contact_attempts | 1:N | Historical contact log. |
| prospect | lead_scores | 1:N | Score history. Current score denormalized on prospect. |
| prospect | prospect_tags | 1:N | Tags attached to prospects. |
| intent_tag | prospect_tags | 1:N | One tag can classify many prospects. |
| conversation | conversation_tags | 1:N | Tags attached to conversations. |
| intent_tag | conversation_tags | 1:N | One tag can classify many conversations. |

## 4. Conversation Relationships

| From | To | Cardinality | Notes |
|---|---|---|---|
| site | conversations | 1:N | Every conversation originates from a site. |
| conversation | messages | 1:N | Ordered by creation date. |
| conversation | conversation_events | 1:N | Non-message events such as consent, fallback, widget opened. |
| conversation | ai_events | 1:N | AI calls and outcomes. |
| conversation | fallback_events | 1:N | Safe-answer failures and missing information. |
| conversation | site_config | N:1 | Records the config version used during the conversation. |

## 5. AI and Knowledge Relationships

| From | To | Cardinality | Notes |
|---|---|---|---|
| organization | knowledge_bases | 1:N | Organization-wide knowledge. |
| site | knowledge_bases | 1:N | Site-specific knowledge. |
| knowledge_base | knowledge_items | 1:N | Content entries or future document chunks. |
| site | faqs | 1:N | FAQ can be site-specific. |
| prompt_template | ai_events | 1:N | AI event records prompt version used. |
| message | ai_events | 0..1:N | AI event may produce or analyze a message. |
| message | fallback_events | 0..1:N | Fallback may relate to a user question. |

## 6. Tracking and Analytics Relationships

| From | To | Cardinality | Notes |
|---|---|---|---|
| visitor | page_views | 1:N | Widget-related page tracking. |
| visitor | utm_events | 1:N | Captured UTM events. |
| conversation | traffic_source | 0..1:1 | Primary source can be attached to a conversation. |
| prospect | conversion_events | 1:N | Lead creation, quote request, customer conversion, etc. |
| site | analytics_snapshots | 1:N | Daily/weekly/monthly aggregates. |
| organization | analytics_snapshots | 1:N | Organization-level aggregates. |

## 7. Notifications and Exports

| From | To | Cardinality | Notes |
|---|---|---|---|
| notification_event | email_events | 1:N | Multiple delivery attempts possible. |
| prospect | notification_events | 0..1:N | Hot prospect alerts. |
| follow_up | notification_events | 0..1:N | Reminder alerts. |
| user | export_jobs | 1:N | User launches export. |
| export_job | export_files | 1:N | One export can generate multiple files. |
| export_job | audit_logs | 1:N | Export request should be audited. |

## 8. RGPD and Privacy Relationships

| From | To | Cardinality | Notes |
|---|---|---|---|
| visitor | consents | 1:N | Consent before or during conversation. |
| prospect | consents | 1:N | Consent after identification. |
| prospect | data_export_requests | 0..1:N | Personal data access requests. |
| visitor | data_export_requests | 0..1:N | Anonymous identity export if verifiable. |
| prospect | deletion_requests | 0..1:N | Right-to-erasure handling. |
| deletion_request | privacy_audit_logs | 1:N | Each action is recorded. |
| data_export_request | privacy_audit_logs | 1:N | Export workflow audit. |

## 9. Multi-Tenant Rule

Every tenant-owned table must include `organization_id` unless it is pure global reference data.

Global reference data may include:

- permissions
- modules
- system-level app settings

Tenant-owned data includes:

- sites
- users
- site configs
- visitors
- prospects
- customers
- conversations
- messages
- knowledge content
- analytics
- exports
- logs
- privacy records

The future schema must enforce organization scoping in service logic and database indexes.
