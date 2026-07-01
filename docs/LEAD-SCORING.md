# Lead Scoring

Lead scoring is a recalculable score from 0 to 100.

## Signals

The current score uses:

- email provided;
- phone provided;
- pricing request;
- availability request;
- booking request;
- date mentioned;
- urgency;
- number of messages;
- returning visitor;
- commercial intent.

## History

Each recalculation writes a `lead_score_history` row with:

- previous score;
- new score;
- reasons;
- timestamp.

The score is therefore explainable and auditable.

## Temperature

- `chaude`: score >= 70
- `tiede`: score >= 40
- `froide`: score < 40

## Status Suggestion

The scoring engine can suggest:

- `Reservation probable` for 82+;
- `Interesse` for 70+;
- `A qualifier` for 55+;
- `Nouveau` below that.
