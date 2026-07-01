# Mobile and Responsive UX

Status: UX/UI specification, no implementation.

## 1. Breakpoints

Recommended design targets:

- desktop: 1440 px and above;
- laptop: 1024-1439 px;
- tablet: 768-1023 px;
- mobile: below 768 px.

## 2. Desktop

Desktop is the primary environment for deep CRM work.

Layout:

- persistent sidebar;
- topbar;
- wide tables;
- split views where useful;
- detail pages with two columns.

## 3. Laptop

Laptop should remain fully productive.

Rules:

- sidebar may collapse;
- table density remains compact;
- widgets wrap cleanly;
- no horizontal scroll for core content when avoidable.

## 4. Tablet

Tablet supports monitoring and light management.

Rules:

- sidebar becomes drawer or compact rail;
- filters use drawers;
- tables may become card lists;
- detail pages stack sections.

## 5. Mobile

Mobile supports urgent checks and quick actions.

Priority tasks:

- view hot prospects;
- read latest conversations;
- call/copy contact;
- add note;
- mark follow-up;
- check dashboard alerts.

Not ideal for:

- heavy configuration;
- bulk exports;
- advanced analytics.

## 6. Mobile Navigation

Options:

- bottom navigation for Dashboard, Conversations, Prospects, Follow-ups;
- menu drawer for remaining sections;
- search as overlay;
- filters as bottom sheet.

## 7. Mobile Tables

Tables become list cards:

- identity/title first;
- status and score visible;
- last interaction visible;
- primary quick action visible;
- secondary actions in overflow menu.

## 8. Widget Mobile UX

The widget must:

- fit viewport;
- keep input visible above keyboard;
- allow easy close;
- keep messages readable;
- avoid covering browser controls;
- support large tap targets.

## 9. Responsive Rules

- No text overlap.
- No hidden primary action.
- No tiny tap targets.
- No horizontal scrolling for normal usage.
- Preserve context when moving from list to detail.
