-- Create reusable function for updating updated_at timestamp
create or replace function update_updated_at_column()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

-- Create opportunity_notes table
create table opportunity_notes (
  id uuid primary key default gen_random_uuid(),
  opportunity_id uuid not null references opportunities(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,

  -- Ratings (1-5, nullable)
  rating_tech_stack smallint check (rating_tech_stack is null or (rating_tech_stack >= 1 and rating_tech_stack <= 5)),
  rating_company smallint check (rating_company is null or (rating_company >= 1 and rating_company <= 5)),
  rating_industry smallint check (rating_industry is null or (rating_industry >= 1 and rating_industry <= 5)),
  rating_role_fit smallint check (rating_role_fit is null or (rating_role_fit >= 1 and rating_role_fit <= 5)),

  -- Links as JSONB array: [{url: string, label: string | null, type: string}]
  links jsonb not null default '[]'::jsonb,

  -- Free-form notes
  notes text,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  -- One notes record per opportunity per user
  unique(opportunity_id, user_id)
);

-- RLS policies
alter table opportunity_notes enable row level security;

create policy "Users can view their own notes"
  on opportunity_notes for select
  using (auth.uid() = user_id);

create policy "Users can insert their own notes"
  on opportunity_notes for insert
  with check (auth.uid() = user_id);

create policy "Users can update their own notes"
  on opportunity_notes for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "Users can delete their own notes"
  on opportunity_notes for delete
  using (auth.uid() = user_id);

-- Updated_at trigger
create trigger set_updated_at
  before update on opportunity_notes
  for each row
  execute function update_updated_at_column();
