create index if not exists idx_prospects_org_updated
  on prospects(organization_id, updated_at desc, created_at desc);

create index if not exists idx_prospects_org_score
  on prospects(organization_id, score desc, updated_at desc);

create index if not exists idx_prospects_org_source
  on prospects(organization_id, source);

create index if not exists idx_prospects_org_platform_presence
  on prospects(organization_id)
  where instagram is not null
     or twitter_x is not null
     or mym is not null
     or onlyfans is not null
     or website is not null
     or linktree is not null
     or allmylinks is not null;

create index if not exists idx_contact_history_org_created
  on contact_history(organization_id, created_at desc);

create index if not exists idx_contact_history_org_contact_date
  on contact_history(organization_id, contact_date desc);

create index if not exists idx_contact_history_org_user_date
  on contact_history(organization_id, user_id, contact_date desc);

create index if not exists idx_prospect_ai_analysis_org_created
  on prospect_ai_analysis(organization_id, created_at desc);

create index if not exists idx_prospect_ai_analysis_latest
  on prospect_ai_analysis(prospect_id, organization_id, created_at desc);

create index if not exists idx_prospect_enrichments_org_created
  on prospect_enrichments(organization_id, created_at desc);

create index if not exists idx_prospect_enrichments_org_confidence
  on prospect_enrichments(organization_id, confidence_score desc);

create index if not exists idx_prospect_field_suggestions_latest
  on prospect_field_suggestions(prospect_id, organization_id, status, created_at desc);

create index if not exists idx_users_organization_role_status
  on users(organization_id, role, status);

create index if not exists idx_users_email_lower
  on users(lower(email));

create index if not exists idx_organizations_slug_lower
  on organizations(lower(slug));

create index if not exists idx_organizations_status_created
  on organizations(status, created_at desc);

create index if not exists idx_crm_activity_log_org_user_created
  on crm_activity_log(organization_id, user_id, created_at desc);
