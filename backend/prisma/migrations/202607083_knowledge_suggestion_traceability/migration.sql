alter table knowledge_suggestions
  add column if not exists accepted_knowledge_item_id uuid references knowledge_items(id) on delete set null,
  add column if not exists resolved_by_user_id uuid references users(id) on delete set null,
  add column if not exists resolved_at timestamptz,
  add column if not exists admin_note text,
  add column if not exists review_queue_id uuid;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'knowledge_suggestions_review_queue_id_fkey'
  ) then
    alter table knowledge_suggestions
      add constraint knowledge_suggestions_review_queue_id_fkey
      foreign key (review_queue_id)
      references chatbot_review_queue(id)
      on delete set null;
  end if;
end $$;

create index if not exists idx_knowledge_suggestions_accepted_item
  on knowledge_suggestions(accepted_knowledge_item_id)
  where accepted_knowledge_item_id is not null;

create index if not exists idx_knowledge_suggestions_review_queue
  on knowledge_suggestions(review_queue_id)
  where review_queue_id is not null;

create index if not exists idx_knowledge_suggestions_resolved_at
  on knowledge_suggestions(organization_id, resolved_at desc)
  where resolved_at is not null;
