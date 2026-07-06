# Changelog

All notable changes to VISITOR-OS will be documented here.

## Sprint 17 - Chatbot Production Hardening & Moto CMS Integration

- Added Railway-hosted public widget script route `/widget/:publicKey.js` for simple Moto CMS integration.
- Added per-site allowed domains, widget copy, colors, welcome/fallback/privacy messages and lead capture settings.
- Added site Q/A CSV import with `examples/site_qa_import.csv`.
- Added unanswered question administration: filter, ignore and convert to Q/A.
- Added public lead capture endpoint with CRM deduplication by email/phone.
- Added chatbot dashboard metrics for conversations, fallback, unanswered questions and captured leads.
- Added Moto CMS installation documentation in `docs/MOTO_CMS_WIDGET_INSTALL.md`.

## Sprint 16 - Chatbot Multi-sites Architecture Alignment

- Added dedicated `chatbot-multisite` backend module for the public acquisition chatbot.
- Preserved all existing CRM, pipeline, AI, enrichment, dashboard, organization, user and prospect modules.
- Kept existing public widget routes while moving multi-site chatbot orchestration into a dedicated service.
- Clarified the separation between the public Chatbot Multi-sites and the private AI CRM Chatbot.
- Added module documentation in `docs/CHATBOT_MULTI_SITES.md`.

## Sprint 16 - AI CRM Chatbot

- Added AI CRM chatbot with read-only natural language access to prospects, pipeline, follow-ups, AI analysis and CRM action lists.
- Added chat sessions and chat messages persistence with organization isolation.
- Added rule-based fallback mode that works without an external AI key.
- Added citations in chatbot answers: prospect, score, status, city, last action and source.
- Added CSV export for chatbot result lists.
- Added admin page `/chat` with history, quick suggestions and prospect result cards.
- Added refusal behavior for destructive or unauthorized requests.
- Added chatbot documentation in `docs/AI_CHATBOT.md`.

## Sprint 15 - Production Validation & First Real Campaign

- Added first-start onboarding status and demo project creation.
- Added `VISITOR DEMO` campaign seed with `demo@visitor-os.app` / `demo123`.
- Added 200 fictitious prospects, contact history, follow-ups, signed prospects and refusals for production validation.
- Added diagnostics and about endpoints for Railway, database, cache, queue, OpenTelemetry, version and runtime visibility.
- Added import intelligence for duplicates, invalid emails, invalid phones, missing cities and ignored columns.
- Added data cleanup preview/apply workflow for spaces, emails, phones, URLs and simple duplicate signals.
- Added Quality Report and full VISITOR-OS ZIP backup export.
- Added admin pages `/first-start`, `/diagnostics`, `/quality` and `/about`.
- Added first-start and quality documentation.

## v1.0.0-RC1 - Sprint 14

- Promoted VISITOR-OS from beta hardening to first Release Candidate.
- Added project, security and UX audits.
- Added admin `/system` page for API, DB, cache, queue, logs, uptime, version and metrics.
- Improved admin keyboard accessibility with visible focus and current navigation state.
- Updated application version metadata to `v1.0.0-RC1`.
- Added administrator, user, installation, backup, troubleshooting, FAQ and QA checklist documentation.
- Added macOS and Windows installation helpers.
- Added complete export/import helper scripts for controlled backup workflows.

## 1.0.0-beta - Sprint 12

- Added production readiness performance report.
- Added PostgreSQL performance indexes for prospects, contact history, AI analysis, enrichments, users, organizations and activity logs.
- Added in-memory TTL cache for dashboard, pipeline metrics, forecast and latest AI analysis.
- Added queue abstraction for batch AI qualification and public enrichment.
- Expanded `/health` with database, cache, queue, log, uptime and version status.
- Added `/metrics` endpoint for minimal production monitoring.
- Added optional rotating file logs for application, error and audit events.
- Added request trace identifiers and OpenTelemetry-ready observability settings.
- Added audit trail storage for important administrative actions.
- Added feature flags for AI, enrichment, forecast, advanced dashboard, and exports.
- Added central runtime settings for scoring, pipeline, forecast, timeouts, rate limits, batch size, and cache TTL.
- Added GitHub Actions CI/CD for lint, tests, coverage, build, migration check, security audit, packaging, and release artifacts.
- Updated deployment, backup, security and performance documentation.
- Added production readiness documentation for observability, audit trail, feature flags, configuration, CI/CD, coverage, and known limitations.

## Sprint 13 - Beta Validation

- Added dirty prospect CSV datasets with 100, 5,000, 50,000 and 100,000 rows.
- Hardened CSV import results with accepted, rejected, ignored and error counters.
- Capped CSV import response previews to 100 prospects.
- Added rejection for invalid emails and overlong import fields.
- Improved deduplication normalization for phones, source URLs, pseudo and city.
- Added admin import summary feedback.
- Added beta validation reports for import, scoring and dashboard behavior.
- Added backend tests for dirty imports, deduplication and invalid pipeline stage handling.

## v0.15.0-auth-production

- Sprint 3 authentication validated in production.
- Added JWT login flow for `POST /login`.
- Added protected identity route `GET /me`.
- Added protected dashboard route `GET /dashboard`.
- Confirmed authentication deployment on Railway.
- Preserved `/live`, `/health` and `/ready` production healthchecks.

## v0.13.0-beta-backend-stable

- Backend deploye sur Railway
- Service Online
- Healthcheck `/live` OK
- Healthcheck `/health` OK
- Healthcheck `/ready` OK
- Demarrage stable sans `DATABASE_URL`
- Railway valide

## v0.12.0-beta-prep - Prompt 19

- Added backend and frontend Dockerfiles.
- Added Docker Compose production stack and environment template.
- Added `/live` and `/ready` health endpoints alongside `/health`.
- Added installation, update, backup, restore and healthcheck scripts.
- Added production deployment documentation, reverse proxy examples and checklist.
- Added minimal static admin runtime configuration for production API URL.
- Corrected production target toward external SaaS platforms with managed PostgreSQL, not OVH Web mutualise.

## v0.11.0-rc2 - Document Intelligence

- Added real KMS file import for PDF, DOCX, TXT, Markdown, HTML, CSV and JSON.
- Added document extraction metadata, warnings and import reports.
- Added configurable chunking with maximum size and overlap.
- Added simple synchronous indexing queue abstraction for future async workers.
- Enhanced knowledge search filters for category, tags and language.
- Prepared RAG interfaces for batch embeddings, vector deletion and context building.
- Added admin file import controls in the existing Knowledge panel.
- Added RC2 documentation for importers, chunking, indexing, search and RAG architecture.

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
