# Knowledge Import

The import flow is:

```text
input -> validation -> document save -> version creation -> chunk indexing
```

Each import creates or updates a document and writes a version.

## Validation

The validator checks:

- organization id
- optional site id
- title
- category
- supported type
- language
- content
- tags

## Future Sources

The architecture prepares future connectors for Google Drive, OneDrive, Notion, Confluence, GitHub, websites, OCR, images and YouTube.
