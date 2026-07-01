# VISITOR-OS - Prompt 10

## Sprint 2 - Conversational Decision Engine

Objectif : ajouter un moteur de decision conversationnel capable de choisir entre FAQ locale, base de connaissance, provider IA abstrait, fallback et escalade humaine.

Contraintes principales :

- ne pas brancher OpenAI directement partout ;
- ne pas transformer le chatbot en simple appel IA ;
- chercher d'abord une reponse locale fiable ;
- garder un provider IA mock si aucune cle API n'est configuree ;
- enregistrer source, confiance, escalade et temps de traitement ;
- afficher ces informations dans l'administration minimale ;
- ne pas ajouter de CRM avance, notifications, authentification, paiements, reservations ou analytics avancees.

Commit attendu :

`Prompt 10: add conversational decision engine`

