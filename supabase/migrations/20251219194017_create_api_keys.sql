-- Create api_keys table for external API authentication
create table api_keys (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references profiles(id) on delete cascade not null,
  key_hash text not null,
  key_prefix text not null,
  name text not null,
  scopes text[] default '{}',
  last_used_at timestamptz,
  expires_at timestamptz,
  revoked_at timestamptz,
  created_at timestamptz default now(),

  constraint valid_key_prefix check (key_prefix ~ '^idn_[a-z0-9]{4}$')
);

-- Index for fast lookup by hash (only non-revoked keys)
create index api_keys_hash_idx on api_keys(key_hash) where revoked_at is null;

-- Index for listing user's keys
create index api_keys_user_id_idx on api_keys(user_id);

-- RLS policies
alter table api_keys enable row level security;

-- Users can only see their own keys
create policy "Users can view own api keys"
  on api_keys for select
  using (auth.uid() = user_id);

-- Users can create keys for themselves
create policy "Users can create own api keys"
  on api_keys for insert
  with check (auth.uid() = user_id);

-- Users can update own keys (for revoking)
create policy "Users can update own api keys"
  on api_keys for update
  using (auth.uid() = user_id);

-- Users can delete own keys
create policy "Users can delete own api keys"
  on api_keys for delete
  using (auth.uid() = user_id);
