-- Tailoring Eval Log: Results from evaluating tailored profiles
-- Used to track hallucinations, missed opportunities, and gaps

create table public.tailoring_eval_log (
  id uuid primary key default gen_random_uuid(),
  tailored_profile_id uuid references public.tailored_profiles(id) on delete cascade not null,
  user_id uuid references public.profiles(id) on delete cascade not null,

  -- Overall result
  passed boolean not null,
  grounding_passed boolean not null,

  -- Detailed findings
  hallucinations jsonb default '[]',  -- [{text, issue}]
  missed_opportunities jsonb default '[]',  -- [{requirement, matching_claim}]
  gaps jsonb default '[]',  -- [{requirement, note}]

  -- Cost tracking
  eval_model text not null,
  eval_cost_cents integer default 0,

  created_at timestamptz default now() not null
);

-- Indexes for common queries
create index tailoring_eval_log_profile_idx on tailoring_eval_log(tailored_profile_id);
create index tailoring_eval_log_user_id_idx on tailoring_eval_log(user_id);

-- Enable RLS
alter table tailoring_eval_log enable row level security;

-- Users can view their own eval logs
create policy "Users can view own tailoring eval logs"
  on tailoring_eval_log for select
  using (auth.uid() = user_id);

-- Users can insert their own eval logs
create policy "Users can insert own tailoring eval logs"
  on tailoring_eval_log for insert
  with check (auth.uid() = user_id);

-- Service role bypass for API routes
create policy "Service role can manage all tailoring eval logs"
  on tailoring_eval_log for all
  using (auth.jwt() ->> 'role' = 'service_role');
