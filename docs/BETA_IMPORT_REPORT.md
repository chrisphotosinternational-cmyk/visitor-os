# Beta Import Report

Sprint 13 validates VISITOR-OS against realistic dirty CSV inputs.

## Datasets

| File | Rows | Size | Accepted dry-run | Rejected dry-run | Duplicate signals | Parse/dedup dry-run |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| `prospects_small_dirty.csv` | 100 | 0.03 MB | 91 | 9 | 88 | 5.6 ms |
| `prospects_medium_dirty.csv` | 5,000 | 1.75 MB | 4,563 | 437 | 4,371 | 72.5 ms |
| `prospects_large_dirty.csv` | 50,000 | 17.72 MB | 45,643 | 4,357 | 43,727 | 628.9 ms |
| `prospects_extreme_dirty.csv` | 100,000 | 35.51 MB | 91,285 | 8,715 | 87,480 | 1,273.4 ms |

## Dirty Data Covered

- Duplicate emails.
- Duplicate phones with different formatting.
- Duplicate source URLs with spacing and casing differences.
- Duplicate pseudo + city pairs.
- Invalid emails.
- Malformed phones.
- Missing cities.
- Broken URLs.
- Empty rows.
- Unknown columns.
- Special characters and accents.
- Very long descriptions.

## Corrections Applied

- Import response now returns counters instead of an unbounded full prospect list.
- Import preview is capped to 100 prospects.
- Rejected rows are counted.
- First 100 import errors are returned with row number and reason.
- Invalid emails are rejected.
- Overlong `source_url` and `description` rows are rejected.
- Phone deduplication normalizes formatting.
- Source URL, pseudo and city deduplication trims and normalizes casing.

## Remaining Limits

- Full import still runs synchronously.
- CSV parsing is acceptable for beta but should become streaming before large public usage.
- Import validation is intentionally conservative; malformed phone numbers are stored but do not block import yet.
- The dry-run benchmark measures parsing and deduplication logic locally, not PostgreSQL write throughput.

## Recommendation

GO for controlled beta import tests. Before v1.0 RC, move 50k+ imports to the queue and stream CSV parsing instead of loading the full payload in memory.

