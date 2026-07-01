# Organizations

## Role

An organization is the tenant boundary in VISITOR-OS.

Every site, visitor, conversation, message, prospect and future user belongs to an organization.

## Fields

- `id`
- `name`
- `slug`
- `description`
- `email`
- `phone`
- `country`
- `language`
- `timezone`
- `currency`
- `status`
- `created_at`

Future SaaS fields are already prepared:

- subscription status
- AI quota
- conversation quota
- storage quota
- plan

## Admin

The minimal admin can create, edit, activate, deactivate and delete organizations.

Deletion is intended for development only until production safeguards and ownership checks are added.

