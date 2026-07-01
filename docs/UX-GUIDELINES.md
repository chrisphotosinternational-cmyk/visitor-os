# VISITOR-OS UX Guidelines

Status: product design guidelines, no implementation yet.

## 1. UX Principles

- Simple before powerful.
- Fast before decorative.
- Clear before clever.
- Fewer clicks whenever possible.
- Professional and calm tone.
- No aggressive lead capture.
- No unnecessary configuration complexity.
- Every screen should help the user decide what to do next.

## 2. Widget UX

## Launcher

- Visible but discreet.
- Must not hide important website content.
- Position configurable later.
- Should load without slowing the page.

## Conversation Window

- Clear welcome message.
- Quick replies visible but not overwhelming.
- Free-text input always available.
- Loading states for assistant responses.
- Clear fallback message when answer is unknown.
- Contact collection should feel like a natural next step.

## Tone

The assistant should sound:

- professional;
- helpful;
- reassuring;
- concise;
- human-friendly without pretending to be human.

The assistant should avoid:

- urgency pressure;
- manipulative wording;
- repeated contact requests;
- overly long answers;
- unsupported claims.

## 3. Admin UX

The admin interface should prioritize:

- what needs attention now;
- hot prospects;
- overdue follow-ups;
- unresolved conversations;
- repeated fallbacks;
- simple configuration.

## Navigation

Expected primary sections:

- Dashboard
- Conversations
- Prospects
- Follow-ups
- Configuration
- Exports
- Settings

## Conversations

Design goals:

- scan quickly;
- identify hot/warm/cold;
- see last message;
- open full history;
- act from the detail view.

## Prospects

Design goals:

- show identity and contactability;
- show status, score, tags, source, and next follow-up;
- make status update easy;
- keep notes close to conversation history.

## Dashboard

Design goals:

- surface action items first;
- avoid vanity-only metrics;
- support quick filtering by site and period;
- show AI usage and cost later without anxiety.

## Configuration

Design goals:

- non-technical wording;
- previews where useful later;
- validation before publish;
- clear separation between public and private settings;
- safe defaults.

## 4. Accessibility Rules

Widget and admin must support:

- keyboard navigation;
- visible focus;
- readable text;
- sufficient color contrast;
- labels for buttons and inputs;
- screen-reader-compatible structure;
- clear errors;
- no color-only status indicators;
- responsive layout;
- reduced motion where relevant.

## 5. Mobile Behavior

Widget:

- must fit small screens;
- input must remain usable with keyboard open;
- buttons must be large enough to tap;
- conversation must not overflow awkwardly.

Admin:

- dashboard and lists should remain readable;
- dense CRM work can prioritize desktop but must not break on mobile.

## 6. Empty States

Empty states should be useful:

- no conversations: explain widget installation/check.
- no prospects: encourage reviewing conversations/configuration.
- no follow-ups: confirm nothing needs action.
- no exports: invite user to create first export when relevant.

Do not use empty states as marketing pages.

## 7. Error States

Errors should:

- use plain language;
- explain what happened;
- suggest the next action;
- avoid exposing technical details;
- be logged for debugging.

## 8. Multilingual UX

- Use site default language.
- Store conversation locale.
- Allow translated welcome messages and quick replies later.
- Avoid mixing languages in a single assistant response.
- If language is unsupported, fallback to site default.

## 9. Visual Direction

- Premium but quiet.
- Professional SaaS style.
- Clear hierarchy.
- Compact CRM lists.
- No visual noise.
- Tenant colors should personalize the widget without damaging accessibility.

## 10. UX Acceptance Criteria

- Visitor can ask a question in under two interactions.
- Contact collection never appears before it is useful.
- Admin can identify hot prospects from the first dashboard view.
- Conversation detail shows enough context to follow up.
- Configuration can be understood without developer knowledge.
- Unknown information results in a clear fallback, not hallucination.
