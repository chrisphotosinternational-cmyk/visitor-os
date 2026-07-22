alter table reasoning_traces add column if not exists knowledge_match_score numeric(4, 3);
alter table reasoning_traces add column if not exists goal_alignment_score numeric(4, 3);
alter table reasoning_traces add column if not exists lead_action_score numeric(4, 3);
alter table reasoning_traces add column if not exists response_quality_score numeric(4, 3);
