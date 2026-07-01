# Software Architecture Document

VISITOR-OS is a modular SaaS platform embedded into Moto CMS 4 through an external JavaScript widget.

## Core Architecture

- Moto CMS hosts only the public website.
- The widget is loaded from VISITOR-OS infrastructure.
- The backend runs on an external Node.js-compatible platform.
- PostgreSQL stores tenants, sites, users, conversations, messages, prospects, configurations, and logs.
- The admin interface is a separate web application.

## V1 Hosting Decision

OVH Web hosting is not used for the backend because it is mutualized hosting intended for PHP/MySQL/CMS workloads, not persistent Node.js applications.

Render is the primary V1 hosting recommendation. Railway remains a valid alternative.
