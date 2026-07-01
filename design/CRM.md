# CRM

Status: UX/UI specification, no implementation.

## 1. Purpose

The CRM answers:

"Which prospects should I follow up first, and what should I do next?"

## 2. Prospects List

Columns:

- identity;
- contact method;
- site;
- status;
- score;
- temperature;
- tags;
- last interaction;
- next follow-up;
- owner later;
- quick actions.

Identity display:

- full name if available;
- email if name missing;
- phone if email missing;
- "Prospect sans nom" only as last resort.

## 3. Filters

Primary filters:

- status;
- temperature;
- score range;
- tags;
- site;
- date created;
- last interaction;
- follow-up due;
- contact available;
- source/UTM;
- archived/lost/client.

Filter behavior:

- filters are visible in a compact bar;
- advanced filters in drawer;
- active filters shown as removable chips;
- saved views later.

## 4. Search

Search by:

- name;
- email;
- phone;
- tag;
- note content later;
- conversation text later.

Exact contact match appears first.

## 5. Sorting

Default sort:

- hot score and recent activity first.

Available sorting:

- newest;
- last interaction;
- score highest;
- follow-up date;
- status;
- site.

## 6. Badges

Recommended badges:

- Hot
- Warm
- Cold
- New
- Follow-up due
- Overdue
- Booking probable
- Quote requested
- Client
- Lost
- Archived

Badges must use text plus color, never color only.

## 7. Quick Actions

From list:

- open prospect;
- add note;
- set follow-up;
- change status;
- copy email/phone;
- archive.

Do not expose too many actions at once. Use overflow menu for secondary actions.

## 8. Prospect Detail

Header:

- identity;
- status;
- score;
- temperature;
- primary contact action;
- next follow-up;
- source/site.

Primary action:

- add follow-up or mark contacted depending on state.

Sections:

- summary;
- contact details;
- score reasons;
- tags;
- notes;
- follow-ups;
- contact attempts;
- conversations;
- timeline;
- privacy/consent where authorized.

## 9. Timeline

Timeline events:

- conversation started;
- message received;
- prospect created;
- score changed;
- tag added;
- note added;
- follow-up created/completed;
- contact attempt;
- status changed;
- export/privacy action where authorized.

Timeline rules:

- newest first by default;
- filters by event type;
- compact but readable.

## 10. Notes

Note behavior:

- add from detail page;
- show author and timestamp;
- allow edit for short period or role-based permission later;
- soft delete rather than hard delete.

## 11. Follow-ups

Fields:

- due date;
- reason;
- priority;
- status;
- assigned user later.

States:

- upcoming;
- due today;
- overdue;
- completed;
- canceled.

## 12. CRM Empty States

No prospects:

- explain that prospects are created from qualified conversations;
- link to conversations;
- link to widget/config setup.

No filtered results:

- show active filters;
- allow clear all;
- suggest broader search.
