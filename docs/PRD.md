# VISITOR-OS Product Requirements Document

Status: functional specification, no implementation yet.

## 1. Product Vision

VISITOR-OS is a modular SaaS platform that helps small businesses transform website visitors into qualified contacts, then organize follow-up through a simple CRM-like workspace.

The first user-facing touchpoint is a lightweight widget embedded into Moto CMS 4 through an external JavaScript script. The widget is not the product by itself. It is the first module of a broader commercial assistant platform.

## 2. Product Goals

- Help visitors obtain fast, reliable, reassuring answers.
- Capture qualified leads without aggressive or intrusive behavior.
- Give business owners a clear view of conversations, prospects, scores, tags, and follow-ups.
- Keep all business-specific behavior configurable without code changes.
- Support many activities: guest house, photographer, wall decoration, studio photo, hotel, restaurant, artisan, lawyer, shop, agency, and liberal professions.
- Prepare future modules without overloading V1.

## 3. Non-Goals for V1

- No full reservation engine.
- No payment flow.
- No invoice or quote generation.
- No advanced automation engine.
- No marketplace.
- No native mobile app.
- No human live chat console unless explicitly added later.
- No business-specific hardcoded logic.

## 4. User Types

### Anonymous Visitor

Needs:

- Understand the offer quickly.
- Ask a question naturally.
- Get reliable answers.
- Avoid being forced to provide personal details too early.
- Know when the assistant does not know.

### Prospect

A prospect is a visitor who has shown commercial intent or provided contact information.

Needs:

- Be guided toward the right next step.
- Leave contact details easily.
- Receive reassurance that a human can follow up.
- Avoid repeated questions if returning in the same context.

### Client

A client is a converted prospect.

Needs:

- Continue receiving relevant support.
- Be recognized as an existing relationship in future modules.
- Benefit from clean handover between conversation history and business follow-up.

### Administrator

Usually the business owner or primary account manager.

Needs:

- Configure the widget and business information.
- Review all conversations and prospects.
- Understand what needs attention.
- Export data.
- Manage site/activity settings.
- Track basic performance.

### Commercial

A team member responsible for lead follow-up.

Needs:

- See assigned or relevant prospects.
- Prioritize hot prospects.
- Add notes.
- Plan follow-ups.
- Track contact attempts.

### Manager

A user responsible for oversight.

Needs:

- See global performance.
- Compare sites or activities.
- Monitor conversion quality.
- Review late follow-ups and high-value opportunities.
- Understand AI usage and cost trends.

## 5. V1 Functional Scope

## Widget

- Loads on Moto CMS through an external script.
- Displays a launcher button.
- Opens manually by visitor action.
- May support configurable auto-open rules later.
- Shows a configurable welcome message.
- Displays configurable quick reply buttons.
- Supports free-text questions.
- Sends messages to the VISITOR-OS backend.
- Shows assistant responses.
- Collects contact information progressively when justified.
- Shows fallback messages when the assistant cannot answer.

## Assistant Behavior

- Professional, calm, helpful, and reassuring.
- Never aggressive.
- Never manipulative.
- Never invents information.
- Clearly says when information is missing.
- Suggests human follow-up when needed.
- Keeps answers concise unless the visitor asks for detail.
- Respects configured business facts and rules.

## Admin

- Shows conversations.
- Shows prospects.
- Shows prospect status, score, tags, notes, and follow-up date.
- Allows basic filtering and export.
- Allows business configuration without code.
- Shows basic dashboard indicators.

## CRM Foundation

- Create prospects from conversations.
- Attach multiple conversations to one prospect when identity is known.
- Support statuses, tags, score, notes, follow-ups, and contact attempts.
- Preserve conversation history.

## 6. Visitor Journey

### Step 1: Arrival on Website

The visitor lands on a Moto CMS page.

Expected behavior:

- The VISITOR-OS script loads asynchronously.
- The page must remain usable if the widget fails.
- The widget must not block rendering.
- The widget receives site-specific public configuration.

### Step 2: Widget Discovery

The visitor sees a launcher button.

Expected behavior:

- The launcher is visible but not intrusive.
- The position, color, and label are configurable.
- Auto-open, if enabled later, must be conservative and limited.

### Step 3: Opening the Widget

The visitor opens the widget manually.

Expected behavior:

- A welcome message appears.
- Quick replies appear if configured.
- The visitor can type freely immediately.

### Step 4: Welcome Message

The assistant greets the visitor based on site configuration.

Expected behavior:

- Message is short and useful.
- It should set expectations: help, information, contact, or reservation preparation.
- It must not pretend to be human.

### Step 5: Quick Reply

The visitor may select a quick reply such as:

- Tarifs
- Disponibilites
- Reserver
- Contact
- Parking
- Acces

Expected behavior:

- The quick reply becomes a user message or structured intent.
- The assistant answers based on validated configuration and FAQ.
- Quick replies are fully configurable per site.

### Step 6: Free Question

The visitor types a natural question.

Expected behavior:

- The assistant interprets intent.
- The assistant uses local facts, FAQ, and configuration.
- If the answer is unknown, it says so and proposes contact.

### Step 7: AI Understanding

The system identifies:

- intent;
- possible tags;
- urgency;
- missing information;
- lead potential;
- whether contact collection is appropriate.

Expected behavior:

- Classification must support CRM but not override visitor experience.
- The assistant should not expose internal scoring.

### Step 8: Response

The assistant responds.

Expected behavior:

- Answer directly when information is known.
- Ask one useful follow-up question when needed.
- Avoid asking for all contact details at once.
- Escalate if the request is sensitive or complex.

### Step 9: Progressive Collection

The assistant asks for information only when context justifies it.

Examples:

- "Je peux transmettre votre demande. Quel est votre prenom ?"
- "Pour vous repondre precisement, pouvez-vous laisser un email ou un telephone ?"

Expected behavior:

- Never request contact details before creating value.
- Never repeatedly ask after refusal.
- Allow partial information.

### Step 10: Prospect Creation

A prospect is created when commercial intent or contact information is sufficient.

Expected behavior:

- The system links conversation, visitor, site, source, UTM, tags, and score.
- The visitor experience remains smooth.
- Consent is recorded when needed.

### Step 11: Notification

If the prospect is hot, urgent, or requires follow-up, a notification may be sent.

Expected behavior:

- Notify the business without spamming.
- Include only useful summary information.
- Link back to the conversation/prospect in admin.

### Step 12: Conversation End

The conversation may end naturally.

Expected behavior:

- The assistant can summarize next step.
- If follow-up is promised, a prospect/follow-up record exists.
- The visitor should feel informed, not pressured.

## 7. Information Collection Rules

## First Name

Ask when:

- the visitor asks to be contacted;
- a booking/quote/reservation request begins;
- a human follow-up is suggested.

Do not ask when:

- the visitor asks a simple informational question;
- the assistant can answer without identification.

## Last Name

Ask when:

- a formal request is being prepared;
- the activity requires it for follow-up;
- the visitor already provided first name and contact method.

Do not ask early in casual discovery.

## Email

Ask when:

- sending details, quote, availability, or follow-up is useful;
- the visitor requests contact;
- the visitor prefers written reply.

Do not ask when:

- the question is simple;
- the visitor refuses contact;
- the assistant has not yet provided value.

## Phone

Ask when:

- urgency is detected;
- the visitor asks to be called;
- the business process benefits from phone follow-up;
- booking or quote clarification is needed.

Do not ask by default if email is enough.

## General Rule

Ask for the minimum useful information. If one field is enough, do not request four.

## 8. Qualification Rules

## Visitor Becomes Prospect

When at least one of these is true:

- provides email or phone;
- requests booking, quote, price, availability, or call-back;
- expresses strong purchase/reservation intent;
- is manually converted by an admin;
- returns with repeated commercial interest.

## Prospect Becomes Client

When:

- admin marks status as Client;
- future booking is confirmed;
- future quote is accepted;
- future payment is completed.

## Conversation Temperature

### Hot

Criteria:

- booking/reservation intent;
- quote requested;
- phone/email provided;
- urgency;
- date or budget mentioned;
- score above configured threshold.

### Warm

Criteria:

- asks about price, availability, service fit, details;
- multiple meaningful messages;
- no direct contact details yet;
- score in medium range.

### Cold

Criteria:

- simple informational question;
- low engagement;
- no contact information;
- no strong intent;
- abandoned conversation after generic question.

## 9. Scoring Behavior

Score range: 0 to 100.

Score increases when:

- email is provided;
- phone is provided;
- visitor asks about price;
- visitor asks about availability;
- visitor requests booking/reservation;
- visitor mentions a date;
- visitor mentions budget;
- urgency is detected;
- the visitor sends several meaningful messages;
- visitor returns after a previous conversation;
- strong intent tags are detected.

Score decreases when:

- conversation is abandoned after a strong intent;
- visitor explicitly says they are not interested;
- request is irrelevant;
- duplicate or spam-like behavior is detected;
- admin marks the prospect as lost.

Notification thresholds:

- Hot prospect: score reaches or exceeds configured hot threshold.
- Urgent request: urgency detected regardless of score.
- Booking probable: booking intent plus contact details or date.
- Call-back requested: phone provided with explicit request.

## 10. Escalation Rules

The assistant should stop trying to answer fully and escalate when:

- the request is complex or ambiguous;
- the visitor makes a complaint;
- the visitor asks for legal, medical, financial, or high-risk advice;
- there is an emergency;
- the answer requires live availability confirmation;
- the visitor asks for a custom quote;
- the visitor is upset or dissatisfied;
- the assistant lacks reliable information;
- the system detects repeated fallback.

Escalation behavior:

- acknowledge the limit;
- avoid inventing;
- propose human follow-up;
- collect minimum useful contact information;
- mark conversation for admin review.

## 11. Notifications

Possible V1 notifications:

- new hot prospect;
- urgent request;
- likely booking/reservation;
- quote requested;
- call-back requested;
- follow-up due;
- follow-up overdue;
- assistant fallback repeated;
- notification failure.

Notification content:

- site;
- visitor/prospect name if known;
- contact method if consented/available;
- reason for notification;
- score;
- tags;
- last user question;
- link to admin record.

Rules:

- Avoid duplicate notifications for the same event.
- Do not send sensitive conversation content unnecessarily.
- Allow notification settings per organization/site later.

## 12. CRM Behavior

## Conversations List

Administrator sees:

- latest conversations;
- site;
- visitor/prospect;
- status;
- temperature;
- score;
- tags;
- last message;
- source page;
- date/time;
- whether follow-up is needed.

Filters:

- site;
- date range;
- status;
- temperature;
- tags;
- score range;
- source;
- has contact details;
- has fallback;
- assigned user later.

## Prospects List

Administrator sees:

- name or partial identity;
- email/phone if available;
- site/source;
- status;
- lifecycle stage;
- score;
- tags;
- last conversation date;
- next follow-up;
- notes count.

Filters:

- status;
- score;
- tags;
- date created;
- site;
- contact method available;
- follow-up due;
- lost/client/archived.

## Prospect Detail

Contains:

- identity;
- contact methods;
- consent status;
- status;
- score and score reasons;
- tags;
- notes;
- follow-ups;
- contact attempts;
- conversation history;
- source and UTM;
- export/privacy actions where authorized.

## 13. Dashboard

V1 dashboard widgets:

- visitors today;
- conversations today;
- new prospects;
- hot prospects;
- average score;
- conversion rate;
- follow-ups due;
- overdue follow-ups;
- top tags;
- top questions;
- fallback count;
- AI calls used later;
- estimated AI cost later.

Principles:

- Prioritize action over vanity metrics.
- Show what needs attention first.
- Keep analytics simple in V1.

## 14. Modules

## Widget Module

Embeds the assistant into external websites.

## Conversation Module

Stores and displays visitor interactions.

## Prospect Module

Creates and manages qualified contacts.

## CRM Module

Adds statuses, notes, tags, follow-ups, and contact attempts.

## Configuration Module

Allows non-code customization by site and activity.

## Notification Module

Sends alerts for important events.

## Export Module

Exports prospects and conversations.

## AI Module

Future module for answer generation, classification, scoring support, fallback detection, and summaries.

## Knowledge Module

Future module for FAQ and validated business facts.

## Future Modules

- bookings;
- payments;
- quotes;
- invoices;
- documents;
- calendar events;
- automations.

## 15. Configuration

Administrators can configure without code:

- brand name;
- activity;
- widget colors;
- welcome message;
- fallback message;
- quick replies;
- business facts;
- business rules;
- contact details;
- links;
- FAQ;
- enabled modules;
- notification recipients;
- scoring thresholds later;
- languages later;
- widget position later;
- opening behavior later.

Configuration rules:

- Changes should be versioned.
- Published configuration should be traceable.
- Invalid configuration should not be published.
- Public widget config must not expose private secrets.

## 16. Multilingual Behavior

V1 should prepare for multilingual use even if one language is active first.

Rules:

- Site config has default locale.
- Conversations store locale.
- FAQ and messages can become locale-specific.
- Assistant should answer in the visitor language when confidently detected and supported.
- If unsupported, use site default language.

## 17. Accessibility

Widget and admin should follow accessibility principles:

- keyboard navigation;
- visible focus states;
- sufficient color contrast;
- readable font sizes;
- semantic labels;
- screen-reader-friendly buttons and inputs;
- no critical information conveyed by color only;
- reduced motion where relevant;
- clear error messages.

## 18. Acceptance Criteria for V1 Product Design

- A visitor can open the widget, ask a question, and receive a configured/controlled response.
- A visitor is not forced to provide contact details before value is delivered.
- A prospect is created when commercial intent or contact data is present.
- Admin can see conversations and prospects.
- Admin can filter and export core CRM data.
- Hot prospects can trigger notifications.
- Configurations can adapt the assistant to multiple business activities.
- Unknown information leads to fallback or escalation, not invention.

## 19. Future Evolution

Potential future capabilities:

- human takeover;
- live chat;
- advanced AI summaries;
- document knowledge base;
- automated FAQ suggestions;
- booking module;
- payment module;
- quote and invoice module;
- calendar integration;
- automations;
- multi-user assignment;
- advanced analytics;
- customer portal.
