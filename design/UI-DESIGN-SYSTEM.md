# UI Design System

Status: UX/UI specification, no implementation.

## 1. Design Language

VISITOR-OS uses a quiet professional SaaS design language:

- restrained surfaces;
- clear data hierarchy;
- compact but breathable layouts;
- precise typography;
- accessible states;
- limited decoration.

## 2. Spacing

Base spacing scale:

- 4 px: micro spacing;
- 8 px: compact spacing;
- 12 px: field/internal spacing;
- 16 px: standard spacing;
- 24 px: section spacing;
- 32 px: major grouping;
- 48 px: page-level separation.

Use spacing to group related information before adding borders.

## 3. Grid

Desktop:

- 12-column content grid where useful;
- max content width for forms;
- full-width tables/lists.

Admin pages:

- list/detail patterns;
- two-column detail layouts where useful;
- avoid decorative card grids for operational pages.

## 4. Radius

Recommended:

- buttons: 6 px;
- inputs: 6 px;
- cards: 8 px maximum;
- badges: pill only for small status labels;
- modals: 8 px.

Avoid overly rounded playful shapes.

## 5. Shadows

Use shadows sparingly:

- dropdowns;
- modals;
- popovers;
- widget panel.

Prefer borders and background contrast for standard panels.

## 6. Buttons

Button types:

- primary;
- secondary;
- ghost;
- danger;
- icon-only;
- text link.

Rules:

- one primary button per section;
- danger actions require confirmation;
- icon-only buttons need accessible labels/tooltips;
- button text must be action-oriented.

## 7. Inputs

Input states:

- default;
- hover;
- focus;
- disabled;
- error;
- success where useful.

Rules:

- labels always visible;
- placeholder never replaces label in forms;
- validation appears close to field;
- required fields clear but not aggressive.

## 8. Cards

Use cards for:

- KPI widgets;
- repeated items;
- summary panels;
- modals.

Do not place cards inside cards.

## 9. Tables

Use tables for CRM and conversations where scanning matters.

Table requirements:

- sticky header later if useful;
- compact rows;
- clear status badges;
- row click opens detail;
- quick actions at row end;
- empty and loading states.

## 10. Modals

Use modals for:

- confirmation;
- short forms;
- focused actions.

Avoid modals for:

- full configuration;
- long forms;
- complex CRM detail.

## 11. Toasts

Use toasts for:

- save success;
- export started;
- notification sent;
- temporary system feedback.

Do not use toasts as the only place for critical errors.

## 12. Menus and Dropdowns

Rules:

- clear labels;
- keyboard navigable;
- close on selection;
- avoid nested dropdowns in V1.

## 13. Density

Default density is professional compact:

- enough information for repeated work;
- no oversized marketing-style blocks;
- readable on laptop screens.
