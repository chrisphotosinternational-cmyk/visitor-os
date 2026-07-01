# Dashboard

Status: UX/UI specification, no implementation.

## 1. Purpose

The dashboard answers:

"What needs my attention now?"

The user should understand the day in less than 3 seconds.

## 2. Above-the-Fold Content

Top priority zone:

- hot prospects count;
- follow-ups due today;
- urgent conversations;
- conversion trend;
- site filter;
- date range.

Primary action:

- Review hot prospects.

Secondary actions:

- Open conversations;
- Create export;
- Edit configuration if repeated fallback appears.

## 3. Recommended Widgets

## Conversations Today

Shows:

- total count;
- comparison with previous period;
- split by site if multiple sites.

Click opens filtered conversations list.

## Hot Prospects

Shows:

- count;
- top 3 hot prospects;
- score;
- intent tag;
- latest message summary.

Click opens CRM filtered by hot score/status.

## Follow-ups Today

Shows:

- due today;
- overdue;
- assigned user later.

Click opens follow-ups list.

## Conversion Rate

Shows:

- conversations to prospects;
- prospects to customers later;
- trend indicator.

Avoid false precision when data volume is low.

## Average Score

Shows:

- average prospect score for selected period;
- top score drivers later.

## AI Cost

V1 may show placeholder or hidden state until AI is active.

Shows later:

- estimated cost;
- number of AI calls;
- average cost per conversation;
- fallback rate.

## Latest Conversations

Shows:

- visitor/prospect;
- site;
- last message;
- time;
- tag/temperature;
- fallback indicator.

## Recent Activity

Shows:

- new prospect;
- status changes;
- notes;
- exports;
- configuration changes.

## Alerts

Shows:

- repeated fallback;
- notification failure;
- overdue follow-ups;
- widget inactive;
- configuration issue.

## Performance by Site

Shows:

- conversations;
- prospects;
- conversion;
- average score;
- top tag.

Only visible when multiple sites exist.

## 4. Layout

Desktop:

- KPI strip at top;
- action/alert panel below;
- latest conversations and hot prospects side by side;
- performance and activity below.

Laptop:

- KPI strip wraps to two rows;
- lists remain readable.

Mobile:

- priority cards stacked;
- hot prospects first;
- follow-ups second;
- latest conversations third.

## 5. Empty State

If no data:

- show setup checklist;
- confirm whether widget is installed;
- offer link to configuration;
- explain that conversations will appear here.

Do not show fake analytics.

## 6. Dashboard Anti-Patterns

- Do not show too many charts in V1.
- Do not bury urgent prospects below vanity metrics.
- Do not use large decorative cards that reduce scan speed.
- Do not show AI cost as alarming without context.
