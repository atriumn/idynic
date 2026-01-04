-- Create view for monthly AI usage per user
CREATE OR REPLACE VIEW public.user_ai_usage_monthly AS
SELECT
  u.user_id,
  date_trunc('month', u.created_at) AS usage_month,
  s.plan_type,
  s.status AS subscription_status,
  count(*) AS operation_count,
  sum(u.input_tokens) AS total_input_tokens,
  sum(u.output_tokens) AS total_output_tokens,
  sum(u.input_tokens + u.output_tokens) AS total_tokens,
  sum(u.cost_cents) AS total_cost_cents,
  round(sum(u.cost_cents)::numeric / 100.0, 2) AS total_cost_dollars,
  count(*) FILTER (WHERE u.operation = 'extract_resume') AS resume_extractions,
  count(*) FILTER (WHERE u.operation = 'extract_evidence') AS evidence_extractions,
  count(*) FILTER (WHERE u.operation = 'claim_synthesis') AS claim_syntheses,
  count(*) FILTER (WHERE u.operation LIKE '%eval%') AS evaluations,
  count(*) FILTER (WHERE u.operation LIKE '%tailor%') AS tailorings
FROM ai_usage_log u
LEFT JOIN subscriptions s ON u.user_id = s.user_id
GROUP BY u.user_id, date_trunc('month', u.created_at), s.plan_type, s.status;
