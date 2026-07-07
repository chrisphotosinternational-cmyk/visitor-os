# Importer Des Connaissances

The Studio import workflow converts documents into proposed knowledge items.

Supported inputs in Sprint 19:

- PDF text content;
- DOCX text content;
- Markdown;
- TXT;
- HTML.

The importer extracts:

- questions;
- candidate answers;
- links;
- tags;
- proposed knowledge items.

## Validation

Imported content is not published automatically.

The administrator reviews the proposal, accepts it, then the items are created as drafts. Publication remains a separate explicit action.

## Limits

The Sprint 19 importer is intentionally conservative. It prepares structured knowledge proposals from text content but does not perform OCR, embeddings, vector search or external crawling.

