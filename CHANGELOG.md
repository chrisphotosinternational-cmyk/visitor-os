# Changelog

All notable changes to VISITOR-OS will be documented here.

## v0.10.0-rc1 - Prompt 18

- Added Knowledge Management System with documents, versions, chunks, search events and statistics.
- Added document import, validation, versioning and simple paragraph/token indexing.
- Added admin Knowledge panel for import, filtering, search, archive and delete.
- Integrated Knowledge Search into the Decision Engine before legacy Knowledge Base and AI.
- Added RAG-ready interfaces for embeddings, vector providers, retrievers and context builders.
- Added KMS documentation and tests.

## v0.9.0-dev - Sprint 9

- Added Analytics Engine for conversations, prospects, scores, tags, AI, notifications, follow-ups and sites.
- Added period filters for today, 7 days, 30 days and custom ranges.
- Added admin analytics dashboard with KPI cards, lightweight charts and performance tables.
- Added CSV/XLSX-compatible analytics exports with RBAC and organization isolation.
- Added analytics snapshots table for future daily, weekly and monthly precomputation.
- Added analytics tests for conversion, score, filters, exports and snapshots.

## v0.8.0-dev - Sprint 8

- Added central Notification Engine with internal, email and webhook providers.
- Added mock email mode so the app works without Resend API credentials.
- Added notification templates, variables, settings and PostgreSQL history.
- Added synchronous queue abstraction with retry support for future worker migration.
- Added minimal admin notification panel with history, filters, settings and test action.
- Routed widget, CRM, AI, export, organization and site notification triggers through the engine.

## v0.7.0-dev - Sprint 7

- Added advanced CRM foundation with lead scoring, score history, tags, notes and follow-ups.
- Added automatic tag detection and manual prospect tag management.
- Added CRM filters and CSV/XLSX-compatible exports with RBAC and organization isolation.
- Added minimal admin CRM panel for prospect detail, timeline, notes, follow-ups and status updates.
- Added CRM tests for scoring, automatic tags and exports.

## v0.6.0-dev - Sprint 6

- Added AI Provider Engine with provider interface, factory, fallback strategy and mock provider.
- Prepared OpenAI, Anthropic, Mistral and Ollama provider architecture without coupling the Decision Engine.
- Added per-organization AI configuration and AI event persistence for provider, model, latency, tokens and estimated cost.
- Added cost estimation utilities and minimal admin AI configuration/test panel.
- Kept FAQ, knowledge base and business rules ahead of AI calls.

## v0.5.0-dev - Sprint 5

- Added admin login, logout and current-user session routes.
- Added bcrypt password hashing and first-admin bootstrap from environment variables.
- Added signed httpOnly session cookies with expiration, revocation and controlled renewal.
- Added RBAC permissions for organizations, sites, conversations, prospects, exports and settings.
- Protected admin routes and enforced organization access for non-SuperAdmin users.
- Added minimal admin login screen, logout button and current user display.

## v0.4.0-dev - Sprint 4

- Added multi-tenant foundation with organizations, sites and prepared users/roles.
- Added site-to-business-configuration association.
- Added widget site resolution by site id, site slug or widget key.
- Added admin endpoints and minimal UI for organizations and sites.
- Prepared organization filters for tenant isolation on conversations and prospects.

## v0.3.0-dev - Sprint 3

- Added Business Configuration Engine with Zod validation, JSON loading, import, export and history.
- Moved Decision Engine behavior to configurable business rules, FAQ and knowledge base.
- Added Prompt Builder for future AI provider prompts without external calls.
- Added active configurations for default, Cherche-Midi, photography and wall decoration examples.
- Added minimal admin configuration panel for viewing, editing, saving, reloading, importing and exporting JSON.

## v0.2.0-dev - Sprint 2

- Added conversational decision engine with FAQ, knowledge base, mock AI provider, fallback and human escalation.
- Stored response source, confidence, escalation flag and processing time on assistant messages.
- Added decision event persistence for future metrics.
- Displayed decision metadata in the minimal admin conversation detail.
- Added tests for FAQ matching, escalation, mock provider fallback and widget-to-admin persistence.

## v0.1.0 - Release Candidate

- Delivered first working MVP flow: widget message, backend response, PostgreSQL persistence, admin dashboard.
- Added conversation search, conversation detail, and conversation status update.
- Added security hardening: validation errors, security headers, production CORS guard, simple in-memory rate limit.
- Added release, security, performance, technical debt, and code review documentation.
- Updated installation and developer experience documentation.

## Unreleased

- Initialized official repository structure.
- Added architecture, product, legal, deployment, design, database, and configuration documentation placeholders.
