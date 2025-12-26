-- Beta codes table for gated beta access
create table public.beta_codes (
  id uuid primary key default gen_random_uuid(),
  code text unique not null,
  max_uses integer not null default 1,
  current_uses integer not null default 0,
  created_by uuid references auth.users(id),
  expires_at timestamptz,
  created_at timestamptz default now()
);

alter table public.beta_codes enable row level security;

-- Function to check if code is valid (without consuming)
create or replace function public.check_beta_code(input_code text)
returns boolean as $$
begin
  return exists (
    select 1 from public.beta_codes
    where code = input_code
      and current_uses < max_uses
      and (expires_at is null or expires_at > now())
  );
end;
$$ language plpgsql security definer;

-- Function to consume a code (called after successful signup)
create or replace function public.consume_beta_code(input_code text, user_id uuid)
returns boolean as $$
declare
  code_record record;
begin
  select * into code_record
  from public.beta_codes
  where code = input_code
    and current_uses < max_uses
    and (expires_at is null or expires_at > now());

  if code_record is null then
    return false;
  end if;

  update public.beta_codes
  set current_uses = current_uses + 1
  where id = code_record.id;

  update public.profiles
  set beta_code_used = input_code
  where id = user_id;

  return true;
end;
$$ language plpgsql security definer;

-- Track which code a user used
alter table public.profiles add column beta_code_used text;

-- Seed some initial codes for testing
insert into public.beta_codes (code, max_uses) values
  ('BETA2025', 100),
  ('FOUNDER', 10);

-- Waitlist for users without codes
create table public.beta_waitlist (
  id uuid primary key default gen_random_uuid(),
  email text unique not null,
  created_at timestamptz default now()
);

alter table public.beta_waitlist enable row level security;

-- Allow anonymous inserts (no auth required)
create policy "Anyone can join waitlist"
  on public.beta_waitlist for insert
  with check (true);
