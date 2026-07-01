# Changelog

All notable changes to VISITOR-OS will be documented here.

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
