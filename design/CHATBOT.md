# Chatbot and Widget UX

Status: UX/UI specification, no implementation.

## 1. Purpose

The widget answers:

"How can we help this visitor now without interrupting their browsing?"

## 2. Launcher

Behavior:

- visible on all pages where enabled;
- fixed position;
- compact;
- accessible label;
- unread/attention indicator only when useful;
- does not cover important site controls.

Manual opening is the default.

Auto-opening:

- disabled by default in V1;
- future option with conservative delay and once-per-session limit.

## 3. Opening and Closing

Opening:

- quick, subtle transition;
- conversation panel appears without layout shift;
- input ready immediately.

Closing:

- preserves current conversation;
- does not erase typed text accidentally;
- allows reopen from launcher.

## 4. Conversation Window

Structure:

- header with brand/site identity;
- short status/help text;
- message area;
- quick replies;
- text input;
- privacy/contact hint when needed.

Header should not be tall or decorative.

## 5. Quick Replies

Rules:

- configurable per site;
- short labels;
- max visible count should stay reasonable;
- overflow can wrap or scroll horizontally on mobile;
- each quick reply maps to an intent or prepared message.

Examples:

- Tarifs
- Disponibilites
- Reserver
- Contact
- Parking
- Acces
- Devis

## 6. Text Input

Behavior:

- supports free text;
- enter sends on desktop;
- send button visible;
- disabled only during critical send state;
- keeps draft during temporary error.

Placeholder:

- plain and inviting;
- not overly familiar.

## 7. Message Types

Visitor messages:

- right or distinct alignment;
- clear timestamp later if needed.

Assistant messages:

- left or neutral alignment;
- concise paragraphs;
- links visible and safe.

System messages:

- subtle;
- used for consent, escalation, or technical status;
- not confused with assistant answers.

## 8. Contact Collection

Principles:

- progressive;
- contextual;
- one or two fields at a time;
- never before value is delivered unless visitor explicitly requests contact.

Contact form behavior:

- inline in conversation;
- clear labels;
- optional fields marked clearly;
- validation messages plain;
- submit confirmation visible.

## 9. Attachments Future

Not in V1.

Future attachment behavior:

- visible only when module enabled;
- clear file size/type limits;
- privacy warning where relevant;
- uploaded files linked to conversation/prospect.

## 10. End of Conversation

Possible endings:

- answer delivered;
- follow-up promised;
- contact request submitted;
- escalation to human;
- visitor closes widget.

Assistant should close with:

- clear next step;
- no pressure;
- no fake certainty.

## 11. Animations

Use:

- short fade/slide for open/close;
- subtle typing/loading indicator;
- no distracting bounce loops;
- respect reduced motion.

## 12. Failure States

If message fails:

- show retry;
- preserve message;
- avoid technical wording.

If assistant cannot answer:

- show configured fallback;
- offer human follow-up.
