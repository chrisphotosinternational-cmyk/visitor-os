alter table prospects add column if not exists pseudo text;
alter table prospects add column if not exists company text;
alter table prospects add column if not exists website text;
alter table prospects add column if not exists instagram text;
alter table prospects add column if not exists twitter_x text;
alter table prospects add column if not exists mym text;
alter table prospects add column if not exists onlyfans text;
alter table prospects add column if not exists linktree text;
alter table prospects add column if not exists allmylinks text;
alter table prospects add column if not exists city text;
alter table prospects add column if not exists activity text;
alter table prospects add column if not exists description text;
alter table prospects add column if not exists source_url text;
alter table prospects add column if not exists score integer not null default 40;
alter table prospects add column if not exists score_label text not null default 'medium';
alter table prospects add column if not exists notes text;

create index if not exists idx_prospects_organization_status
  on prospects(organization_id, status);

create index if not exists idx_prospects_organization_score_label
  on prospects(organization_id, score_label);

create index if not exists idx_prospects_organization_city
  on prospects(organization_id, city);

create index if not exists idx_prospects_organization_email
  on prospects(organization_id, lower(email));

create index if not exists idx_prospects_organization_phone
  on prospects(organization_id, phone);

create index if not exists idx_prospects_organization_source_url
  on prospects(organization_id, source_url);
