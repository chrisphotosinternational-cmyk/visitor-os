# UX Wireframes

Status: textual wireframes, no graphic mockups and no code.

## 1. App Shell

```text
+-------------------------------------------------------------+
| Topbar: Page title | Site filter | Search | Alerts | Account |
+-------------+-----------------------------------------------+
| Sidebar     | Main content                                   |
| Dashboard   |                                               |
| Conversations                                               |
| Prospects                                                   |
| Follow-ups                                                  |
| Analytics                                                   |
| Exports                                                     |
| Config                                                      |
+-------------+-----------------------------------------------+
```

## 2. Dashboard

```text
Page title: Dashboard
Context: Today / selected site
Primary action: Review hot prospects

[Hot prospects] [Follow-ups today] [Conversations today] [Conversion]

[Alerts / Needs attention]

[Latest conversations]       [Hot prospect shortlist]

[Performance by site]        [Recent activity]
```

Immediate answer: what needs attention now.

## 3. Conversations List

```text
Page title: Conversations
Filters: Site | Date | Temperature | Tag | Fallback | Contact
Search: message, prospect, email, phone

List/Table:
Visitor/Prospect | Last message | Site | Tags | Temperature | Time | Action
```

Detail:

```text
Conversation header:
Prospect/link | Site | Status | Temperature | Source

Message thread

Side panel:
Score | Tags | Contact info | Notes | Follow-up | Events
```

## 4. CRM Prospects

```text
Page title: Prospects
Primary action: Export or Add follow-up depending context
Filters: Status | Score | Tags | Site | Follow-up | Contact
Search: name, email, phone

Table:
Identity | Contact | Status | Score | Tags | Last interaction | Follow-up | Actions
```

## 5. Prospect Detail

```text
Header:
Name/contact | Status | Score | Temperature | Primary action

Left:
Summary
Contact details
Tags
Score reasons

Right:
Next follow-up
Notes
Contact attempts

Full width:
Timeline
Conversations
Privacy/consent
```

## 6. Configuration

```text
Page title: Configuration
Tabs/sections:
Widget | Business facts | Quick replies | FAQ | Notifications | Modules | Privacy

Section layout:
Explanation
Editable fields
Preview/status
Save/Publish action
```

## 7. Settings Screens

```text
Settings navigation:
Organization
Sites
Users
Emails
Notifications
RGPD
Modules
AI configuration
```

AI configuration:

```text
Purpose and safety rules
Prompt behavior summary
Fallback behavior
Cost/usage limits later
Save changes
```

Business configuration:

```text
Activity
Business facts
Rules
Contact details
Links
Fallback message
Publish version
```

Widget configuration:

```text
Brand
Colors
Position later
Welcome message
Quick replies
Preview later
Publish version
```

Notifications:

```text
Recipients
Hot prospect alerts
Urgent request alerts
Follow-up reminders
Failure alerts
```

RGPD:

```text
Consent settings
Retention policy
Data export requests
Deletion/anonymization requests
Privacy audit access
```

Users:

```text
User list
Role/status
Invite action later
Disable user
```

## 8. Widget

Closed:

```text
[ Launcher button ]
```

Open:

```text
+--------------------------+
| Brand / Assistant   [x]  |
| Welcome message          |
| [Quick] [Replies]        |
|                          |
| Visitor / Assistant msgs |
|                          |
| Input field        Send  |
+--------------------------+
```

Contact collection:

```text
Assistant message explaining reason
[First name]
[Email or phone]
[Send request]
```

## 9. Exports

```text
Page title: Exports
Primary action: Create export

Export history:
Type | Filters | Requested by | Status | Created | Expires | Download
```

## 10. Mobile Layout

```text
Topbar: Title | Search/Action
Content stacked cards
Bottom nav or drawer:
Dashboard | Conversations | Prospects | Follow-ups | More
```
