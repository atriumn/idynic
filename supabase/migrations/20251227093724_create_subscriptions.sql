-- Subscriptions table for tracking user billing plans
create table public.subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles(id) on delete cascade not null,
  stripe_customer_id text unique,
  stripe_subscription_id text unique,
  plan_type text not null default 'free' check (plan_type in ('free', 'pro', 'job_search')),
  status text not null default 'active' check (status in ('active', 'canceled', 'past_due', 'incomplete', 'trialing')),
  current_period_start timestamptz,
  current_period_end timestamptz,
  cancel_at_period_end boolean default false,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),

  unique(user_id)
);

alter table public.subscriptions enable row level security;

-- Users can read their own subscription
create policy "Users can view own subscription"
  on public.subscriptions for select
  using (auth.uid() = user_id);

-- No direct user insert/update - only service role via webhooks

-- Indexes for quick lookups
create index subscriptions_user_id_idx on public.subscriptions(user_id);
create index subscriptions_stripe_customer_id_idx on public.subscriptions(stripe_customer_id);
create index subscriptions_stripe_subscription_id_idx on public.subscriptions(stripe_subscription_id);


-- Monthly usage tracking for rate-limited features
create table public.usage_tracking (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles(id) on delete cascade not null,
  period_start date not null,
  uploads_count integer not null default 0,
  tailored_profiles_count integer not null default 0,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),

  unique(user_id, period_start)
);

alter table public.usage_tracking enable row level security;

-- Users can read their own usage
create policy "Users can view own usage"
  on public.usage_tracking for select
  using (auth.uid() = user_id);

-- Index for quick lookups
create index usage_tracking_user_period_idx on public.usage_tracking(user_id, period_start);


-- Function to get current period start (first of month)
create or replace function public.get_current_period_start()
returns date as $$
begin
  return date_trunc('month', now())::date;
end;
$$ language plpgsql immutable;


-- Function to get or create current period usage
create or replace function public.get_or_create_usage(p_user_id uuid)
returns public.usage_tracking as $$
declare
  v_period_start date;
  v_usage public.usage_tracking;
begin
  v_period_start := public.get_current_period_start();

  -- Try to get existing record
  select * into v_usage
  from public.usage_tracking
  where user_id = p_user_id and period_start = v_period_start;

  -- Create if not exists
  if v_usage is null then
    insert into public.usage_tracking (user_id, period_start)
    values (p_user_id, v_period_start)
    returning * into v_usage;
  end if;

  return v_usage;
end;
$$ language plpgsql security definer;


-- Function to increment upload count
create or replace function public.increment_upload_count(p_user_id uuid)
returns void as $$
declare
  v_period_start date;
begin
  v_period_start := public.get_current_period_start();

  insert into public.usage_tracking (user_id, period_start, uploads_count)
  values (p_user_id, v_period_start, 1)
  on conflict (user_id, period_start)
  do update set
    uploads_count = public.usage_tracking.uploads_count + 1,
    updated_at = now();
end;
$$ language plpgsql security definer;


-- Function to increment tailored profiles count
create or replace function public.increment_tailored_profiles_count(p_user_id uuid)
returns void as $$
declare
  v_period_start date;
begin
  v_period_start := public.get_current_period_start();

  insert into public.usage_tracking (user_id, period_start, tailored_profiles_count)
  values (p_user_id, v_period_start, 1)
  on conflict (user_id, period_start)
  do update set
    tailored_profiles_count = public.usage_tracking.tailored_profiles_count + 1,
    updated_at = now();
end;
$$ language plpgsql security definer;


-- Function to get user's plan type (with fallback to free)
create or replace function public.get_user_plan_type(p_user_id uuid)
returns text as $$
declare
  v_plan_type text;
begin
  select plan_type into v_plan_type
  from public.subscriptions
  where user_id = p_user_id
    and status in ('active', 'trialing');

  return coalesce(v_plan_type, 'free');
end;
$$ language plpgsql security definer stable;


-- Auto-create subscription record for new users (defaults to free)
create or replace function public.handle_new_user_subscription()
returns trigger as $$
begin
  insert into public.subscriptions (user_id, plan_type, status)
  values (new.id, 'free', 'active');
  return new;
end;
$$ language plpgsql security definer;

-- Trigger to create subscription on profile creation
create trigger on_profile_created_subscription
  after insert on public.profiles
  for each row execute procedure public.handle_new_user_subscription();
