# Navigation

Status: UX/UI specification, no implementation.

## 1. Global Layout

Desktop layout:

- left sidebar for primary navigation;
- topbar for global context and actions;
- main content area;
- optional right panel only for contextual detail, never for core navigation.

The app must always show the current organization/site context when relevant.

## 2. Sidebar

Primary entries:

- Dashboard
- Conversations
- Prospects
- Follow-ups
- Analytics
- Exports
- Configuration
- Settings

Future entries:

- Bookings
- Documents
- Automations
- Payments

Sidebar behavior:

- fixed on desktop;
- collapsible on laptop;
- icon plus label by default;
- icon-only collapsed state;
- active item clearly highlighted;
- grouped secondary items under Configuration/Settings.

The sidebar answers: "Where am I in the product?"

## 3. Topbar

Topbar contains:

- current page title;
- selected site filter if applicable;
- date range if applicable;
- global search;
- notifications;
- help;
- user account menu.

Topbar rules:

- never overloaded;
- page-specific primary action may appear on the right;
- avoid duplicating sidebar navigation.

## 4. Breadcrumb

Use breadcrumbs for nested pages:

- Prospects > Marie Durand
- Conversations > Conversation #1234
- Configuration > Widget > Colors

Do not use breadcrumbs on simple top-level pages.

## 5. Global Search

Search scope:

- prospects;
- conversations;
- emails;
- phones;
- tags;
- notes later;
- site names.

Behavior:

- keyboard shortcut later;
- recent searches later;
- results grouped by type;
- exact contact matches first;
- no results state with suggestions.

## 6. Notifications

Notification menu shows:

- hot prospects;
- urgent requests;
- booking/quote signals;
- follow-ups due;
- failed notifications;
- repeated fallbacks;
- system alerts.

Rules:

- unread count visible;
- priority indicators;
- click opens related record;
- avoid noisy low-value notifications.

## 7. Account Menu

Contains:

- profile;
- organization switcher later;
- user preferences;
- billing later;
- sign out.

## 8. Help

Help entry provides:

- short product guidance;
- setup checklist;
- documentation links later;
- support contact later.

Do not turn help into a distraction.

## 9. Settings Navigation

Settings sections:

- Organization
- Sites
- Users
- Roles later
- Notifications
- Privacy/RGPD
- Integrations
- Modules

Configuration sections:

- AI configuration;
- business configuration;
- widget configuration;
- email settings;
- notification rules;
- RGPD/privacy;
- enabled modules;
- users and roles.

Settings rule:

- operational settings belong in Settings;
- visitor-facing behavior belongs in Configuration;
- advanced technical settings should be hidden behind progressive disclosure.

## 10. Mobile Navigation

Mobile uses:

- bottom navigation for main sections, or hamburger drawer if density grows;
- topbar with title and primary action;
- search as full-screen overlay;
- filters as bottom sheet;
- record details as stacked pages.

Mobile priority:

- check urgent prospects;
- read conversations;
- add quick notes;
- mark follow-up.
