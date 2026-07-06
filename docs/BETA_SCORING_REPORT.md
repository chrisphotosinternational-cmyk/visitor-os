# Beta Scoring Report

Sprint 13 reviewed scoring behavior against complete, weak, inconsistent and multi-platform profiles.

## Rules Verified

- City present: score increases.
- Email present: score increases.
- Phone present: score increases.
- Instagram or X present: score increases.
- MYM or OnlyFans present: score increases strongly.
- Website, Linktree or AllMyLinks present: score increases.
- Coherent description present: score increases.
- No contact method: score is penalized.

## Expected Behavior

| Profile Type | Expected Result |
| --- | --- |
| Complete profile with city, email, phone, social and premium platform | `high` or `very_high` |
| Weak profile with only pseudo and city | `ignore` or `low` |
| No contact method | penalty applied |
| Multi-platform public profile | score increases |
| Blacklisted prospect | status remains business-controlled; scoring does not override blacklist |
| Inconsistent data | row can be imported if valid enough, but score remains explainable |

## Corrections Applied

- Import rejects invalid emails before scoring.
- Overlong descriptions are rejected instead of inflating memory usage.
- Deduplicated rows are merged and rescored from the merged record.

## Remaining Limits

- Scoring remains deterministic and simple.
- Scoring does not yet use weighted organization-specific settings in every path.
- Blacklist is a status, not a negative scoring rule.

## Recommendation

GO for beta. Keep the scoring simple until real usage proves which signals matter.

