-- Work history extracted from resumes
create table work_history (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  document_id uuid references documents(id) on delete cascade not null,
  company text not null,
  title text not null,
  start_date text not null,
  end_date text, -- null = current role
  location text,
  summary text,
  order_index int not null default 0,
  created_at timestamptz default now() not null
);

-- Index for user lookups
create index work_history_user_id_idx on work_history(user_id);
create index work_history_document_id_idx on work_history(document_id);

-- Add work_history reference to evidence table
alter table evidence add column work_history_id uuid references work_history(id) on delete set null;
create index evidence_work_history_id_idx on evidence(work_history_id);

-- Enable RLS
alter table work_history enable row level security;

create policy "Users can view own work history"
  on work_history for select
  using (auth.uid() = user_id);

create policy "Users can insert own work history"
  on work_history for insert
  with check (auth.uid() = user_id);

create policy "Users can update own work history"
  on work_history for update
  using (auth.uid() = user_id);

create policy "Users can delete own work history"
  on work_history for delete
  using (auth.uid() = user_id);
