# Chatbot Studio

Chatbot Studio is the no-code administration layer for public VISITOR-OS chatbots.

It does not replace the CRM, Knowledge Engine, widget, pipeline, AI qualification or enrichment modules. It orchestrates them so an administrator can create, test and publish a chatbot without writing code.

## Workspace

The admin route is `/studio`.

Each connected site has its own Studio with:

- chatbot state;
- intention count;
- knowledge count;
- conversations today;
- unknown questions;
- answer rate;
- generated leads;
- published version;
- last publication date.

## Wizard

The creation wizard asks for:

- name;
- domain;
- business type;
- primary goal;
- tone;
- template.

The wizard creates draft intentions, draft knowledge items, personality settings and goals.

## Simulation

The simulation mode lets an administrator test a visitor question before publication.

It returns:

- reply;
- detected intent;
- matched knowledge item;
- confidence;
- fallback state;
- actions that would be triggered.

## Publication

Publishing promotes draft knowledge to active knowledge and records a Studio version.

The public widget continues to use the existing response order:

1. active Knowledge Engine items;
2. legacy site Q/A;
3. existing Decision Engine fallback.

