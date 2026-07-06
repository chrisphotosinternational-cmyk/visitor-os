# Roadmap

## Current Development - Sprint 17

- Chatbot production hardening for Moto CMS 4
- Public widget script route `/widget/:publicKey.js`
- Per-site allowed domains and widget settings
- Site Q/A CSV import
- Questions sans reponse workflow
- Lead capture settings and CRM conversion without duplicates
- Chatbot metrics by site
- Moto CMS installation documentation

## Previous Development - Sprint 16

- Chatbot Multi-sites as the public acquisition engine
- Dedicated backend module for site-specific widget conversations
- CRM handoff without replacing existing CRM, pipeline, AI or enrichment modules
- AI CRM chatbot
- Natural language CRM questions
- Read-only pipeline, relance, scoring and opportunity analysis
- Rule-based fallback without external AI provider
- Citations and CSV export for chatbot answers
- Admin `/chat` page

## Previous Development - Sprint 15

- Production validation with first real campaign workflow
- Demo organization and demo admin account
- First-start onboarding assistant
- Import intelligence and data cleanup assistant
- Quality Report
- Full VISITOR-OS backup export
- Diagnostics and About pages

## Previous Development - v1.0.0-RC1

- First Release Candidate
- Project audit
- Security audit
- UX audit
- Admin `/system` monitoring page
- RC1 documentation pack
- macOS and Windows installation helpers
- Complete export/import helper scripts
- Final QA checklist before production release

## Previous Development - 1.0.0-beta

- Production readiness
- PostgreSQL performance indexes
- Dashboard and pipeline cache
- Batch job queue abstraction
- Enhanced health and metrics endpoints
- Optional file logs with rotation
- Observability trace IDs and OpenTelemetry-ready configuration
- Audit trail for critical administrative and CRM actions
- Feature flags and central runtime configuration
- CI/CD checks for lint, tests, build, migration checks, coverage and security audit
- Backup, performance and security documentation
- Beta validation with dirty CSV datasets up to 100,000 rows
- Import hardening for rejected rows, capped previews and deduplication normalization

## Before v1.0 RC

- Move large imports to queue jobs
- Add streaming CSV parsing
- Add import progress API
- Add large export jobs
- Increase backend coverage toward the target threshold

## Current Development - v0.12.0-beta-prep

- Production deployment preparation
- Docker backend image
- Docker frontend image
- Docker Compose stack
- Production environment template
- Health, readiness and liveness endpoints
- Backup and restore scripts
- Installation, update and troubleshooting documentation
- Render/Railway-first deployment guidance with managed PostgreSQL

## Current Development - v0.11.0-rc2

- Document Intelligence
- Real file import for PDF, DOCX, TXT, Markdown, HTML, CSV and JSON
- Text extraction and metadata preservation
- Configurable chunking
- Simple indexing queue
- Text/category/tag/language search
- RAG architecture preparation without embeddings

## Current Development - v0.10.0-rc1

- Knowledge Management System
- Document import and validation
- Simple indexation and search
- Document versioning
- Knowledge statistics
- Decision Engine document priority
- RAG-ready interfaces

## Current Development - v0.9.0-dev

- Analytics Engine
- KPI dashboard
- Conversations and prospects per day
- Site performance
- Frequent tags
- Response sources and fallback rate
- AI cost and notification metrics
- Analytics exports and snapshots

## Current Development - v0.8.0-dev

- Notification Engine
- Internal notifications
- Email provider abstraction with Resend-ready adapter
- Mock email provider for local/V1 operation
- Webhook provider
- Notification settings and history
- Queue abstraction for future asynchronous delivery

## Current Development - v0.7.0-dev

- Advanced CRM
- Lead scoring and score history
- Automatic and manual tags
- Internal notes
- Follow-ups
- Filtered CSV/XLSX exports

## Current Development - v0.6.0-dev

- AI Provider Engine
- Mock provider and OpenAI provider abstraction
- Provider factory and fallback strategy
- AI cost estimation
- AI events for future monitoring
- Minimal admin AI configuration

## Current Development - v0.5.0-dev

- Admin authentication
- Signed httpOnly sessions
- RBAC permissions
- Organization access control
- Protected admin UI

## Current Development - v0.4.0-dev

- Organizations and sites
- Prepared users and roles
- Site to business configuration association
- Widget site id, slug and key resolution
- Tenant isolation filters

## Current Development - v0.3.0-dev

- Business Configuration Engine
- Multi-business JSON configuration
- Configurable FAQ, knowledge base and business rules
- Prompt Builder for future AI providers
- Admin import/export and configuration history

## Current Development - v0.2.0-dev

- Conversational decision engine
- FAQ and knowledge base matching
- Mock AI provider ready for future OpenAI integration
- Human escalation for sensitive or uncertain requests
- Minimal decision metrics stored for later analysis

## Current Release - v0.1.0 RC

- MVP widget demo
- Backend conversation/message persistence
- Temporary non-AI reply
- Minimal admin dashboard
- Conversation search
- Conversation status update
- Hardening pass and release documentation

## V1 - Foundation

- Repository structure
- Architecture documentation
- Data model design
- Backend skeleton
- Admin skeleton
- Widget skeleton
- PostgreSQL setup
- Basic configuration model

## V1.1 - First Usable Flow

- Widget loading on Moto CMS
- Conversation creation
- Message storage
- Admin conversation view
- Basic lead capture

## V2 - SaaS Utility

- Mini CRM
- Tags and notes
- Exports
- Notifications
- Activity templates
- AI-assisted qualification

## V3 - Platform Expansion

- Scoring
- Reminders
- Statistics
- Document knowledge base
- Automations
- Calendar and booking modules

## Not Before Product-Market Fit

- Microservices
- Native mobile app
- Marketplace
- SSO enterprise
- Complex workflow engine
- Self-hosted AI infrastructure
