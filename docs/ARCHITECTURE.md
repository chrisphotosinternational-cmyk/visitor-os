# Architecture Overview

## Runtime Components

- `widget`: external script embedded into Moto CMS.
- `backend`: API, business logic, authentication, conversations, prospects, exports, and integrations.
- `frontend-admin`: private administration interface.
- `database`: PostgreSQL schemas and migrations.

## External Services

- Render for V1 hosting.
- PostgreSQL managed database.
- Resend for email notifications later.
- Sentry for error monitoring later.
- OpenAI API for AI features later.

## Integration Model

Moto CMS loads the widget script. The widget communicates with the backend API. The backend stores and processes data independently from Moto CMS.
