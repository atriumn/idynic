-- Tailored profiles generated for user/opportunity pairs
create table tailored_profiles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  opportunity_id uuid references opportunities(id) on delete cascade not null,
  talking_points jsonb not null,
  narrative text,
  resume_data jsonb,
  created_at timestamptz default now() not null,
  unique(user_id, opportunity_id)
);

-- Indexes
create index tailored_profiles_user_id_idx on tailored_profiles(user_id);
create index tailored_profiles_opportunity_id_idx on tailored_profiles(opportunity_id);

-- Enable RLS
alter table tailored_profiles enable row level security;

create policy "Users can view own tailored profiles"
  on tailored_profiles for select
  using (auth.uid() = user_id);

create policy "Users can insert own tailored profiles"
  on tailored_profiles for insert
  with check (auth.uid() = user_id);

create policy "Users can update own tailored profiles"
  on tailored_profiles for update
  using (auth.uid() = user_id);

create policy "Users can delete own tailored profiles"
  on tailored_profiles for delete
  using (auth.uid() = user_id);
