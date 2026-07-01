# Components

Status: UX/UI specification, no implementation.

## 1. Core Components

## App Shell

Includes:

- sidebar;
- topbar;
- content area;
- responsive mobile navigation.

## Page Header

Contains:

- title;
- subtitle/context;
- primary action;
- optional filters/date range.

## KPI Card

Contains:

- metric label;
- value;
- trend;
- context;
- click-through target.

Rules:

- no decorative icons unless useful;
- trend must be understandable.

## Data Table

Used for:

- prospects;
- conversations;
- exports;
- users later.

Features:

- search;
- filters;
- sorting;
- pagination later;
- row actions;
- loading skeleton;
- empty state.

## Filter Bar

Contains:

- primary filters;
- active filter chips;
- clear all;
- advanced filters trigger.

## Badge

Used for:

- status;
- temperature;
- score band;
- tags;
- notification state.

Rules:

- text plus color;
- consistent naming.

## Score Indicator

Displays:

- numeric score;
- band label;
- optional explanation link.

Bands:

- 0-39 cold;
- 40-69 warm;
- 70-100 hot.

## Tag Chip

Used for:

- intent;
- custom classification;
- filters.

Behavior:

- removable when editable;
- read-only when system-generated unless permission allows.

## Conversation Message

Types:

- visitor;
- assistant;
- system;
- error/fallback.

Displays:

- content;
- sender;
- timestamp where useful;
- metadata in collapsed view later.

## Timeline Item

Used in prospect detail.

Includes:

- event type;
- time;
- actor;
- summary;
- related action.

## Note Composer

Fields:

- note content;
- save action;
- optional visibility later.

Rules:

- autosave later, not V1 requirement;
- clear save feedback.

## Follow-up Form

Fields:

- date;
- priority;
- reason;
- assigned user later.

## Empty State

Contains:

- short title;
- useful explanation;
- one primary action;
- optional secondary link.

## Error State

Contains:

- clear issue;
- recovery action;
- support/log reference later.

## Toast

Short-lived confirmation or status message.

## Modal

Use for confirmation or short focused tasks.

## 2. Widget Components

- launcher button;
- widget panel;
- message list;
- quick replies;
- text input;
- contact form;
- typing indicator;
- fallback block;
- close/minimize button.

## 3. Component Rules

- Components must be accessible by keyboard.
- Components must expose loading, empty, error, disabled, and success states where relevant.
- Component text must be concise.
- Avoid one-off visual patterns.
