-- Claim Issues: Issues linked to specific identity claims
-- Used by the claim eval system to flag problems (duplicates, missing fields, ungrounded claims)

create table public.claim_issues (
  id uuid primary key default gen_random_uuid(),
  claim_id uuid references public.identity_claims(id) on delete cascade not null,
  document_id uuid references public.documents(id) on delete cascade,

  issue_type text not null check (issue_type in ('duplicate', 'missing_field', 'not_grounded', 'unevaluated', 'other')),
  severity text not null check (severity in ('error', 'warning')) default 'warning',
  message text not null,

  -- For duplicates: which claim is this a duplicate of
  related_claim_id uuid references public.identity_claims(id) on delete set null,

  -- Dismissed by user
  dismissed_at timestamptz,

  created_at timestamptz default now() not null
);

-- Indexes for common queries
create index claim_issues_claim_id_idx on claim_issues(claim_id);
create index claim_issues_active_idx on claim_issues(claim_id) where dismissed_at is null;
create index claim_issues_document_id_idx on claim_issues(document_id);

-- Enable RLS
alter table claim_issues enable row level security;

-- Users can view issues for their own claims
create policy "Users can view own claim issues"
  on claim_issues for select
  using (
    exists (
      select 1 from identity_claims
      where identity_claims.id = claim_issues.claim_id
      and identity_claims.user_id = auth.uid()
    )
  );

-- Users can insert issues for their own claims
create policy "Users can insert own claim issues"
  on claim_issues for insert
  with check (
    exists (
      select 1 from identity_claims
      where identity_claims.id = claim_issues.claim_id
      and identity_claims.user_id = auth.uid()
    )
  );

-- Users can update issues for their own claims (for dismissal)
create policy "Users can update own claim issues"
  on claim_issues for update
  using (
    exists (
      select 1 from identity_claims
      where identity_claims.id = claim_issues.claim_id
      and identity_claims.user_id = auth.uid()
    )
  );

-- Users can delete issues for their own claims
create policy "Users can delete own claim issues"
  on claim_issues for delete
  using (
    exists (
      select 1 from identity_claims
      where identity_claims.id = claim_issues.claim_id
      and identity_claims.user_id = auth.uid()
    )
  );

-- Service role bypass for Inngest functions
create policy "Service role can manage all claim issues"
  on claim_issues for all
  using (auth.jwt() ->> 'role' = 'service_role');
