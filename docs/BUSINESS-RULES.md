# VISITOR-OS Business Rules

Status: functional rules, no implementation yet.

## 1. Contact Collection

General principle:

- Ask only for information that is useful now.
- Never ask for all contact fields at the beginning.
- Do not repeat contact requests after refusal.
- Always provide value before asking for contact information when possible.

## 2. When to Ask for Personal Information

| Field | Ask when | Avoid when |
|---|---|---|
| First name | Contact, booking, quote, call-back, personalized follow-up. | Simple information request. |
| Last name | Formal request, reservation, quote, professional follow-up. | Early casual conversation. |
| Email | Written follow-up, quote, details, availability reply. | Visitor only wants generic info. |
| Phone | Urgent request, call-back, booking clarification. | Email is enough or visitor refuses. |

## 3. Prospect Creation

Create a prospect when:

- email or phone is provided;
- visitor asks to be contacted;
- visitor asks for booking/reservation;
- visitor asks for quote/devis;
- visitor asks for availability with date;
- visitor shows strong commercial intent;
- admin manually converts conversation.

Do not create a prospect when:

- visitor asks one generic question;
- no commercial intent exists;
- interaction appears spam-like;
- visitor explicitly refuses follow-up.

## 4. Customer Conversion

A prospect becomes customer when:

- admin marks status as Client;
- future booking is confirmed;
- future quote is accepted;
- future payment succeeds;
- future manual import confirms customer relationship.

## 5. Conversation Temperature

## Hot

Examples:

- booking request;
- quote request;
- urgent need;
- phone/email provided;
- date and service mentioned;
- high score.

## Warm

Examples:

- asks price or availability;
- compares options;
- gives project details;
- sends several meaningful messages;
- no contact details yet.

## Cold

Examples:

- simple FAQ question;
- low engagement;
- no buying signal;
- visitor leaves quickly;
- irrelevant request.

## 6. Score Rules

Score increases:

- email provided;
- phone provided;
- price request;
- availability request;
- booking request;
- date mentioned;
- budget mentioned;
- urgency;
- repeated engagement;
- strong intent tag;
- returning visitor.

Score decreases:

- explicit disinterest;
- abandoned strong-intent conversation;
- irrelevant request;
- spam-like behavior;
- admin marks lost.

Rules:

- Score is an aid, not an absolute truth.
- Score must be explainable.
- Manual overrides should be logged later.
- Notifications should use both score and intent.

## 7. Notification Rules

Send notification for:

- hot prospect;
- urgent request;
- likely booking;
- quote requested;
- call-back requested;
- follow-up due;
- follow-up overdue;
- repeated fallback;
- important error.

Avoid notification when:

- conversation is informational only;
- prospect was already notified for same event;
- data is too uncertain;
- notification settings disable it later.

## 8. Chatbot Behavior Rules

The assistant must:

- be professional;
- be reassuring;
- be concise;
- answer from validated information;
- admit unknown information;
- suggest human follow-up when useful;
- avoid pressure tactics;
- avoid pretending to be human;
- avoid legal, medical, financial, or high-risk advice.

The assistant must not:

- invent prices, availability, deadlines, stock, or policies;
- confirm reservations without configured capability;
- make promises the business has not validated;
- ask for unnecessary personal data;
- continue arguing with upset visitors.

## 9. Escalation Rules

Escalate when:

- request is complex;
- complaint is detected;
- urgent or sensitive topic is detected;
- legal or high-risk advice is requested;
- custom quote is required;
- confirmed availability is required;
- repeated fallback occurs;
- visitor asks for a human.

Escalation output:

- clear acknowledgment;
- no invented answer;
- minimal contact request;
- conversation marked for review;
- notification if appropriate.

## 10. Quick Reply Rules

Quick replies:

- are configurable per site;
- should be short;
- should map to an intent;
- should be ordered by business priority;
- should not exceed a reasonable number in the widget.

Examples:

- Tarifs
- Disponibilites
- Reserver
- Contact
- Parking
- Acces
- Devis
- Horaires

## 11. CRM Status Rules

Minimum statuses:

- Nouveau
- A qualifier
- Interesse
- A rappeler
- Reservation probable
- Devis demande
- Client
- Perdu
- Archive

Rules:

- New commercial records start as Nouveau or A qualifier.
- A rappeler requires a follow-up date where possible.
- Client indicates conversion.
- Perdu remains useful for analytics.
- Archive removes from active workflows without deleting history.

## 12. Duplicate Rules

Matching priority:

1. normalized email;
2. normalized phone;
3. same visitor identity;
4. manual review.

Rules:

- Do not auto-merge uncertain records.
- Never merge across organizations.
- Keep site attribution after merge.
- Future merge action must be audited.

## 13. Configuration Rules

Admin may configure:

- brand name;
- activity;
- colors;
- welcome message;
- quick replies;
- business facts;
- behavior rules;
- fallback message;
- contact information;
- links;
- FAQ;
- enabled modules;
- notification recipients;
- thresholds later.

Rules:

- Published config is versioned.
- Invalid config cannot be published.
- Public widget config excludes secrets.
- Business-specific behavior belongs in configuration, not code.

## 14. Export Rules

Exports must:

- be user-initiated;
- be organization-scoped;
- support filters;
- be logged;
- expire if stored as files;
- avoid permanent public links.

Export columns should include:

- date;
- site;
- activity;
- first name;
- last name;
- email;
- phone;
- status;
- score;
- tags;
- last question;
- last answer;
- conversation;
- notes;
- follow-up date;
- source;
- UTM.

## 15. Privacy Rules

- Track consent by purpose.
- Do not use personal data for commercial follow-up without appropriate consent/legal basis.
- Allow export and deletion/anonymization workflows.
- Keep aggregate analytics after anonymization when possible.
- Do not store unnecessary sensitive data.
