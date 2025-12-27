-- AI Usage Log for internal cost/performance tracking
-- No RLS - accessed via service role only

create table public.ai_usage_log (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles(id) on delete cascade,

  -- What was called
  operation text not null,        -- 'extract_resume', 'extract_evidence', etc.
  provider text not null,         -- 'openai', 'google', 'anthropic'
  model text not null,            -- 'gpt-4o-mini', 'gpt-5-mini', 'gemini-2.0-flash', etc.

  -- Token usage
  input_tokens integer not null default 0,
  output_tokens integer not null default 0,

  -- Cost (in USD cents to avoid floating point issues)
  cost_cents integer not null default 0,

  -- Performance
  latency_ms integer not null default 0,

  -- Status
  success boolean not null default true,
  error_message text,

  -- Context (optional, for debugging)
  document_id uuid,
  opportunity_id uuid,

  created_at timestamptz default now() not null
);

-- Indexes for querying
create index ai_usage_log_user_id_idx on ai_usage_log(user_id);
create index ai_usage_log_created_at_idx on ai_usage_log(created_at);
create index ai_usage_log_user_operation_idx on ai_usage_log(user_id, operation);
create index ai_usage_log_provider_model_idx on ai_usage_log(provider, model);
