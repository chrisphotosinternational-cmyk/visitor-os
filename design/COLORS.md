# Colors

Status: UX/UI specification, no implementation.

## 1. Color Philosophy

VISITOR-OS should feel professional and calm. Color is used for hierarchy, status, and action, not decoration.

Avoid:

- one-note purple/blue gradients;
- beige-heavy visual identity;
- excessive bright accents;
- status by color only.

## 2. Light Mode Palette

Neutral:

- page background: near-white;
- surface: white;
- muted surface: very light gray;
- border: soft gray;
- text primary: near-black;
- text secondary: slate gray;
- text muted: medium gray.

Accent:

- primary accent: deep teal or refined blue-green;
- secondary accent: neutral blue-gray;
- focus ring: accessible blue.

## 3. Dark Mode Palette

Dark mode can be future-ready but not required in V1.

Neutral:

- page background: deep neutral;
- surface: slightly lighter neutral;
- border: muted gray;
- text primary: off-white;
- text secondary: light gray;
- text muted: medium gray.

Accent:

- primary accent must remain accessible;
- avoid neon colors.

## 4. System Colors

Success:

- used for completed follow-up, sent notification, saved state.

Warning:

- used for overdue follow-up, low confidence, pending attention.

Error:

- used for failed action, invalid form, unavailable service.

Information:

- used for neutral notices, setup guidance, fallback explanations.

## 5. CRM Semantic Colors

Temperature:

- hot: strong but not alarming;
- warm: amber/orange family;
- cold: neutral gray/blue.

Statuses:

- New: information color;
- To qualify: neutral;
- Interested: positive;
- Follow-up: warning;
- Booking probable: strong accent;
- Quote requested: accent;
- Client: success;
- Lost: muted;
- Archived: gray.

## 6. Widget Colors

Widget uses tenant configuration:

- primary color;
- secondary color;
- text contrast validation;
- fallback to default accessible palette if invalid.

Rules:

- tenant colors must not break readability;
- button text contrast must remain accessible;
- admin should warn about poor contrast later.
