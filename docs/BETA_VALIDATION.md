# Beta Validation

Sprint 13 focuses on real-data hardening rather than new product functionality.

## Tested Areas

- Dirty CSV datasets.
- CSV import counters and rejection handling.
- Deduplication by email, phone, source URL, pseudo and city.
- Scoring consistency.
- Pipeline invalid status handling.
- Dashboard behavior with high-volume datasets.
- AI and enrichment flows without mandatory external calls.
- Frontend handling for import summaries and oversized responses.

## Volumes

- 100 rows.
- 5,000 rows.
- 50,000 rows.
- 100,000 rows.

## Corrections Applied

- Capped import response preview to 100 prospects.
- Added accepted, rejected, ignored and error counters to import results.
- Rejected invalid emails.
- Rejected overlong source URLs and descriptions.
- Normalized phone, source URL, pseudo and city deduplication.
- Added UI import summary after CSV import.
- Added backend tests for dirty import, deduplication and invalid pipeline stages.

## Known Limits

- Full CSV import still runs synchronously.
- CSV parsing is not streaming yet.
- Frontend tables are not virtualized.
- Coverage target above 95% is not yet reached.
- Large export remains synchronous.

## Recommendation Before v1.0 RC

- Move large imports to queue jobs.
- Add streaming CSV parser.
- Add import progress API.
- Add export jobs for large datasets.
- Add test coverage for repository edge cases until backend coverage reaches the target.

## Beta Decision

GO for internal beta validation with controlled datasets.

