# Loading States

Status: UX/UI specification, no implementation.

## 1. Loading Principles

- Preserve layout.
- Show progress near the affected content.
- Avoid full-page blocking when partial loading is enough.
- Make slow operations understandable.

## 2. Initial Page Load

Use:

- page skeleton;
- stable header/sidebar;
- content placeholders.

Avoid:

- blank screens;
- jumping layout.

## 3. Table Loading

Use:

- skeleton rows;
- disabled filters only when necessary;
- keep table header visible.

## 4. Detail Page Loading

Use:

- header skeleton;
- section skeletons;
- avoid showing empty fields as if data is missing.

## 5. Widget Loading

States:

- script loading: no visible disruption;
- widget config loading: launcher fallback if needed;
- assistant response loading: subtle typing indicator;
- message sending: local pending state.

## 6. Export Loading

Export may take time.

Behavior:

- show job status;
- allow user to leave page;
- notify when complete later;
- avoid spinner-only long wait.

## 7. Save Loading

Behavior:

- button shows saving state;
- prevent duplicate submit;
- preserve form;
- show success after completion.

## 8. Loading Text

Use plain labels:

- Loading conversations...
- Saving configuration...
- Preparing export...
- Sending message...

Avoid vague "Please wait" everywhere.
