-- Enable vector extension
create extension if not exists vector;

-- 1. Profiles (extends Supabase Auth)
create table profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  name text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- 2. Documents (resumes, stories)
create table documents (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references profiles(id) on delete cascade not null,
  type text not null check (type in ('resume', 'story')),
  filename text,
  storage_path text,
  raw_text text,
  status text default 'pending' check (status in ('pending', 'processing', 'completed', 'failed')),
  created_at timestamptz default now()
);

-- 3. Claims (extracted facts)
create table claims (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references profiles(id) on delete cascade not null,
  document_id uuid references documents(id) on delete cascade,
  claim_type text not null,
  value jsonb not null,
  evidence_text text,
  confidence float default 1.0,
  embedding vector(1536),
  created_at timestamptz default now()
);

-- 4. Opportunities (jobs)
create table opportunities (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references profiles(id) on delete cascade not null,
  title text not null,
  company text,
  url text,
  description text,
  requirements jsonb,
  status text default 'tracking' check (status in ('tracking', 'applied', 'interviewing', 'offer', 'rejected', 'archived')),
  embedding vector(1536),
  created_at timestamptz default now()
);

-- 5. Matches (claim <-> opportunity scores)
create table matches (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references profiles(id) on delete cascade not null,
  opportunity_id uuid references opportunities(id) on delete cascade not null,
  claim_id uuid references claims(id) on delete cascade not null,
  score float not null,
  created_at timestamptz default now(),
  unique(opportunity_id, claim_id)
);

-- Indexes
create index claims_user_id_idx on claims(user_id);
create index claims_embedding_idx on claims using ivfflat (embedding vector_cosine_ops) with (lists = 100);
create index opportunities_user_id_idx on opportunities(user_id);
create index opportunities_embedding_idx on opportunities using ivfflat (embedding vector_cosine_ops) with (lists = 100);
create index matches_opportunity_idx on matches(opportunity_id);

-- Row Level Security
alter table profiles enable row level security;
alter table documents enable row level security;
alter table claims enable row level security;
alter table opportunities enable row level security;
alter table matches enable row level security;

create policy "Users can view own profile" on profiles for all using (auth.uid() = id);
create policy "Users can manage own documents" on documents for all using (auth.uid() = user_id);
create policy "Users can manage own claims" on claims for all using (auth.uid() = user_id);
create policy "Users can manage own opportunities" on opportunities for all using (auth.uid() = user_id);
create policy "Users can manage own matches" on matches for all using (auth.uid() = user_id);

-- Vector search function
create or replace function match_claims(
  query_embedding vector(1536),
  match_user_id uuid,
  match_threshold float,
  match_count int
)
returns table (
  id uuid,
  claim_type text,
  value jsonb,
  evidence_text text,
  similarity float
)
language sql stable
as $$
  select
    claims.id,
    claims.claim_type,
    claims.value,
    claims.evidence_text,
    1 - (claims.embedding <=> query_embedding) as similarity
  from claims
  where claims.user_id = match_user_id
    and 1 - (claims.embedding <=> query_embedding) > match_threshold
  order by claims.embedding <=> query_embedding
  limit match_count;
$$;

-- Trigger to auto-create profile on user signup
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, email, name)
  values (new.id, new.email, new.raw_user_meta_data->>'name');
  return new;
end;
$$ language plpgsql security definer;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();
