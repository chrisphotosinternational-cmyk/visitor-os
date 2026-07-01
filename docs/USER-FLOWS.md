# VISITOR-OS User Flows

Status: functional flow specification, no implementation yet.

## 1. Visitor Flow: Standard Question

1. Visitor arrives on Moto CMS site.
2. Widget script loads asynchronously.
3. Visitor opens widget manually.
4. Widget displays welcome message and quick replies.
5. Visitor selects a quick reply or asks a free question.
6. System identifies intent and relevant configuration.
7. Assistant answers using known business facts and FAQ.
8. If the answer is complete, conversation remains informational.
9. Conversation is stored with page, source, locale, and config version.

Success criteria:

- Visitor receives a useful answer.
- No unnecessary contact request appears.
- Admin can later view the conversation.

## 2. Visitor Flow: Lead Creation

1. Visitor asks about price, availability, booking, quote, or service fit.
2. Assistant answers when possible.
3. Assistant asks one relevant follow-up question if needed.
4. If follow-up requires human reply, assistant asks for minimal contact details.
5. Visitor provides email or phone.
6. System creates or updates a prospect.
7. Conversation is linked to the prospect.
8. Tags and score are assigned.
9. Notification is sent if score/intent threshold is met.
10. Assistant confirms the next step.

Success criteria:

- Contact collection feels natural.
- Prospect has source, site, score, tags, and conversation history.
- Business owner receives notification when needed.

## 3. Visitor Flow: Unknown Information

1. Visitor asks a question.
2. Assistant cannot find reliable information in configuration, FAQ, or knowledge.
3. Assistant explicitly says the information is not confirmed.
4. Assistant proposes human follow-up.
5. If visitor agrees, assistant collects minimal contact data.
6. Fallback event is recorded.
7. Admin can identify missing knowledge later.

Success criteria:

- Assistant does not invent.
- Visitor has a clear next step.
- Missing information becomes actionable.

## 4. Visitor Flow: Escalation

Escalation triggers:

- complaint;
- legal/high-risk request;
- urgency;
- custom quote;
- emotional dissatisfaction;
- repeated fallback;
- live availability required.

Flow:

1. Assistant acknowledges the request.
2. Assistant stops giving uncertain answers.
3. Assistant proposes human follow-up.
4. Assistant asks only necessary contact information.
5. Conversation is marked for admin review.
6. Notification may be sent.

Success criteria:

- Risk is reduced.
- Visitor feels heard.
- Admin sees the conversation priority.

## 5. Returning Visitor Flow

1. Visitor returns to the site.
2. Widget identifies existing anonymous visitor when allowed.
3. If a previous prospect is known, the system can link new conversation.
4. Assistant does not expose private history in the widget unless designed later.
5. Admin sees multiple conversations under the same prospect when identity is clear.

Success criteria:

- CRM history is preserved.
- Visitor privacy remains protected.

## 6. Admin Flow: Review Conversations

1. Admin opens conversations list.
2. Admin filters by date, site, status, tag, temperature, or fallback.
3. Admin opens a conversation.
4. Admin sees messages, source page, tags, score, and linked prospect.
5. Admin can add note, update status, create follow-up, or convert to prospect.

Success criteria:

- Admin understands what happened quickly.
- Follow-up action is easy.

## 7. Commercial Flow: Follow Up Prospect

1. Commercial opens prospects list.
2. Filters hot prospects or follow-ups due.
3. Opens prospect detail.
4. Reviews conversation summary, contact details, score, tags, and notes.
5. Records contact attempt.
6. Updates status.
7. Schedules next follow-up if needed.

Success criteria:

- No lead is lost.
- Prospect history stays complete.

## 8. Manager Flow: Monitor Activity

1. Manager opens dashboard.
2. Reviews conversations, prospects, conversion rate, score average, and follow-ups.
3. Filters by site or period.
4. Identifies high-performing tags/questions and repeated fallbacks.
5. Requests configuration or FAQ improvements.

Success criteria:

- Manager sees product value and operational issues.
- Data leads to action.

## 9. Configuration Flow

1. Admin opens site settings.
2. Edits brand, colors, welcome message, quick replies, business facts, rules, contact, links, fallback, FAQ, and modules.
3. System validates configuration.
4. Admin previews changes later.
5. Admin publishes a new version.
6. New conversations record the active config version.

Success criteria:

- Admin can adapt behavior without code.
- Invalid settings are blocked.
- Previous behavior remains traceable.

## 10. Export Flow

1. Admin opens export section or prospect list.
2. Selects filters and format.
3. System creates export job.
4. Export file is generated.
5. Admin downloads file.
6. Export is logged.
7. File expires later.

Success criteria:

- Export is scoped and auditable.
- Sensitive data is not exposed through permanent links.
