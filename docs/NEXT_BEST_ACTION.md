# Next Best Action

La next best action indique ce que le chatbot devrait faire apres sa reponse.

## Actions disponibles

- `answer_only`
- `ask_clarifying_question`
- `suggest_cta`
- `capture_lead`
- `propose_phone_call`
- `propose_whatsapp`
- `create_prospect`
- `escalate_to_admin`
- `end_conversation`

## Selection

Le moteur tient compte de :

- confiance de la reponse ;
- objectif du site ;
- score de lead readiness ;
- intention detectee ;
- contexte de conversation.

## Principes

- ne jamais forcer une capture ;
- ne jamais modifier des donnees sans logique explicite ;
- escalader si la confiance est faible ;
- proposer une clarification avant de deviner.
