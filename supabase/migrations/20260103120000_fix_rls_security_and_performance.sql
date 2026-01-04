-- Security and performance fixes:
-- 1. Fix SECURITY DEFINER views to filter by auth.uid()
-- 2. Fix beta_codes RLS policies
-- 3. Fix all RLS policies to use (SELECT auth.uid()) for performance

-- ============================================
-- 1. SECURITY DEFINER VIEWS
-- ============================================

-- Recreate user_ai_usage_monthly with user filtering
DROP VIEW IF EXISTS public.user_ai_usage_current_month;
DROP VIEW IF EXISTS public.user_ai_usage_monthly;

CREATE VIEW public.user_ai_usage_monthly
WITH (security_invoker = false)
AS
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
WHERE u.user_id = (SELECT auth.uid())
GROUP BY u.user_id, date_trunc('month', u.created_at), s.plan_type, s.status;

CREATE VIEW public.user_ai_usage_current_month
WITH (security_invoker = false)
AS
SELECT * FROM user_ai_usage_monthly
WHERE usage_month = date_trunc('month', now());

DROP VIEW IF EXISTS public.user_workflow_usage;

CREATE VIEW public.user_workflow_usage
WITH (security_invoker = false)
AS
WITH workflow_usage AS (
    SELECT
        user_id,
        COALESCE(job_id::text, document_id::text, opportunity_id::text, 'unknown') AS workflow_id,
        CASE
            WHEN job_id IS NOT NULL THEN 'job'
            WHEN document_id IS NOT NULL THEN 'resume'
            WHEN opportunity_id IS NOT NULL THEN 'opportunity'
            ELSE 'other'
        END AS workflow_type,
        min(created_at) AS started_at,
        max(created_at) AS completed_at,
        count(*) AS operation_count,
        array_agg(DISTINCT operation ORDER BY operation) AS operations,
        sum(input_tokens + output_tokens) AS total_tokens,
        sum(cost_cents) AS cost_cents,
        round(sum(cost_cents)::numeric / 100.0, 2) AS cost_dollars,
        round(sum(latency_ms)::numeric / 1000.0, 1) AS total_seconds,
        bool_and(success) AS all_succeeded
    FROM ai_usage_log
    WHERE user_id = (SELECT auth.uid())
    GROUP BY
        user_id,
        COALESCE(job_id::text, document_id::text, opportunity_id::text, 'unknown'),
        CASE
            WHEN job_id IS NOT NULL THEN 'job'
            WHEN document_id IS NOT NULL THEN 'resume'
            WHEN opportunity_id IS NOT NULL THEN 'opportunity'
            ELSE 'other'
        END
)
SELECT
    w.user_id,
    w.workflow_id,
    w.workflow_type,
    w.started_at,
    w.completed_at,
    w.operation_count,
    w.operations,
    w.total_tokens,
    w.cost_cents,
    w.cost_dollars,
    w.total_seconds,
    w.all_succeeded,
    COALESCE(j.filename, d.filename, o.title, 'Unknown') AS workflow_name,
    j.job_type
FROM workflow_usage w
LEFT JOIN document_jobs j ON w.workflow_type = 'job' AND j.id::text = w.workflow_id
LEFT JOIN documents d ON w.workflow_type = 'resume' AND d.id::text = w.workflow_id
LEFT JOIN opportunities o ON w.workflow_type = 'opportunity' AND o.id::text = w.workflow_id
ORDER BY w.started_at DESC;

GRANT SELECT ON public.user_ai_usage_monthly TO authenticated;
GRANT SELECT ON public.user_ai_usage_current_month TO authenticated;
GRANT SELECT ON public.user_workflow_usage TO authenticated;

-- ============================================
-- 2. BETA_CODES RLS POLICIES
-- ============================================

CREATE POLICY "Anyone can validate beta codes"
  ON public.beta_codes FOR SELECT TO anon, authenticated
  USING (true);

CREATE POLICY "Service role can manage beta codes"
  ON public.beta_codes FOR ALL TO public
  USING ((SELECT auth.jwt()) ->> 'role' = 'service_role')
  WITH CHECK ((SELECT auth.jwt()) ->> 'role' = 'service_role');

-- ============================================
-- 3. FIX ALL RLS POLICIES FOR PERFORMANCE
-- Wrap auth.uid()/auth.jwt() in (SELECT ...)
-- ============================================

-- ai_usage_log
DROP POLICY IF EXISTS "Service role can manage all ai usage logs" ON public.ai_usage_log;
CREATE POLICY "Service role can manage all ai usage logs"
  ON public.ai_usage_log FOR ALL TO public
  USING ((SELECT auth.jwt()) ->> 'role' = 'service_role')
  WITH CHECK ((SELECT auth.jwt()) ->> 'role' = 'service_role');

-- api_keys
DROP POLICY IF EXISTS "Users can create own api keys" ON public.api_keys;
DROP POLICY IF EXISTS "Users can delete own api keys" ON public.api_keys;
DROP POLICY IF EXISTS "Users can update own api keys" ON public.api_keys;
DROP POLICY IF EXISTS "Users can view own api keys" ON public.api_keys;

CREATE POLICY "Users can view own api keys"
  ON public.api_keys FOR SELECT TO authenticated
  USING (user_id = (SELECT auth.uid()));
CREATE POLICY "Users can create own api keys"
  ON public.api_keys FOR INSERT TO authenticated
  WITH CHECK (user_id = (SELECT auth.uid()));
CREATE POLICY "Users can update own api keys"
  ON public.api_keys FOR UPDATE TO authenticated
  USING (user_id = (SELECT auth.uid()));
CREATE POLICY "Users can delete own api keys"
  ON public.api_keys FOR DELETE TO authenticated
  USING (user_id = (SELECT auth.uid()));

-- claim_evidence
DROP POLICY IF EXISTS "Users can manage own claim_evidence" ON public.claim_evidence;
CREATE POLICY "Users can manage own claim_evidence"
  ON public.claim_evidence FOR ALL TO authenticated
  USING (EXISTS (
    SELECT 1 FROM identity_claims
    WHERE identity_claims.id = claim_evidence.claim_id
    AND identity_claims.user_id = (SELECT auth.uid())
  ));

-- claim_issues
DROP POLICY IF EXISTS "Service role can manage all claim issues" ON public.claim_issues;
DROP POLICY IF EXISTS "Users can delete own claim issues" ON public.claim_issues;
DROP POLICY IF EXISTS "Users can insert own claim issues" ON public.claim_issues;
DROP POLICY IF EXISTS "Users can update own claim issues" ON public.claim_issues;
DROP POLICY IF EXISTS "Users can view own claim issues" ON public.claim_issues;

CREATE POLICY "Service role can manage all claim issues"
  ON public.claim_issues FOR ALL TO public
  USING ((SELECT auth.jwt()) ->> 'role' = 'service_role')
  WITH CHECK ((SELECT auth.jwt()) ->> 'role' = 'service_role');
CREATE POLICY "Users can view own claim issues"
  ON public.claim_issues FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM identity_claims
    WHERE identity_claims.id = claim_issues.claim_id
    AND identity_claims.user_id = (SELECT auth.uid())
  ));
CREATE POLICY "Users can insert own claim issues"
  ON public.claim_issues FOR INSERT TO authenticated
  WITH CHECK (EXISTS (
    SELECT 1 FROM identity_claims
    WHERE identity_claims.id = claim_issues.claim_id
    AND identity_claims.user_id = (SELECT auth.uid())
  ));
CREATE POLICY "Users can update own claim issues"
  ON public.claim_issues FOR UPDATE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM identity_claims
    WHERE identity_claims.id = claim_issues.claim_id
    AND identity_claims.user_id = (SELECT auth.uid())
  ));
CREATE POLICY "Users can delete own claim issues"
  ON public.claim_issues FOR DELETE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM identity_claims
    WHERE identity_claims.id = claim_issues.claim_id
    AND identity_claims.user_id = (SELECT auth.uid())
  ));

-- claims
DROP POLICY IF EXISTS "Users can delete own claims" ON public.claims;
DROP POLICY IF EXISTS "Users can insert own claims" ON public.claims;
DROP POLICY IF EXISTS "Users can update own claims" ON public.claims;
DROP POLICY IF EXISTS "Users can view own claims" ON public.claims;

CREATE POLICY "Users can view own claims"
  ON public.claims FOR SELECT TO authenticated
  USING (user_id = (SELECT auth.uid()));
CREATE POLICY "Users can insert own claims"
  ON public.claims FOR INSERT TO authenticated
  WITH CHECK (user_id = (SELECT auth.uid()));
CREATE POLICY "Users can update own claims"
  ON public.claims FOR UPDATE TO authenticated
  USING (user_id = (SELECT auth.uid()));
CREATE POLICY "Users can delete own claims"
  ON public.claims FOR DELETE TO authenticated
  USING (user_id = (SELECT auth.uid()));

-- document_jobs
DROP POLICY IF EXISTS "Users can insert own jobs" ON public.document_jobs;
DROP POLICY IF EXISTS "Users can view own jobs" ON public.document_jobs;

CREATE POLICY "Users can view own jobs"
  ON public.document_jobs FOR SELECT TO authenticated
  USING (user_id = (SELECT auth.uid()));
CREATE POLICY "Users can insert own jobs"
  ON public.document_jobs FOR INSERT TO authenticated
  WITH CHECK (user_id = (SELECT auth.uid()));

-- documents
DROP POLICY IF EXISTS "Users can delete own documents" ON public.documents;
DROP POLICY IF EXISTS "Users can insert own documents" ON public.documents;
DROP POLICY IF EXISTS "Users can update own documents" ON public.documents;
DROP POLICY IF EXISTS "Users can view own documents" ON public.documents;

CREATE POLICY "Users can view own documents"
  ON public.documents FOR SELECT TO authenticated
  USING (user_id = (SELECT auth.uid()));
CREATE POLICY "Users can insert own documents"
  ON public.documents FOR INSERT TO authenticated
  WITH CHECK (user_id = (SELECT auth.uid()));
CREATE POLICY "Users can update own documents"
  ON public.documents FOR UPDATE TO authenticated
  USING (user_id = (SELECT auth.uid()));
CREATE POLICY "Users can delete own documents"
  ON public.documents FOR DELETE TO authenticated
  USING (user_id = (SELECT auth.uid()));

-- evidence
DROP POLICY IF EXISTS "Users can manage own evidence" ON public.evidence;
CREATE POLICY "Users can manage own evidence"
  ON public.evidence FOR ALL TO authenticated
  USING (user_id = (SELECT auth.uid()))
  WITH CHECK (user_id = (SELECT auth.uid()));

-- identity_claims
DROP POLICY IF EXISTS "Users can manage own identity_claims" ON public.identity_claims;
CREATE POLICY "Users can manage own identity_claims"
  ON public.identity_claims FOR ALL TO authenticated
  USING (user_id = (SELECT auth.uid()))
  WITH CHECK (user_id = (SELECT auth.uid()));

-- matches
DROP POLICY IF EXISTS "Users can delete own matches" ON public.matches;
DROP POLICY IF EXISTS "Users can insert own matches" ON public.matches;
DROP POLICY IF EXISTS "Users can update own matches" ON public.matches;
DROP POLICY IF EXISTS "Users can view own matches" ON public.matches;

CREATE POLICY "Users can view own matches"
  ON public.matches FOR SELECT TO authenticated
  USING (user_id = (SELECT auth.uid()));
CREATE POLICY "Users can insert own matches"
  ON public.matches FOR INSERT TO authenticated
  WITH CHECK (user_id = (SELECT auth.uid()));
CREATE POLICY "Users can update own matches"
  ON public.matches FOR UPDATE TO authenticated
  USING (user_id = (SELECT auth.uid()));
CREATE POLICY "Users can delete own matches"
  ON public.matches FOR DELETE TO authenticated
  USING (user_id = (SELECT auth.uid()));

-- opportunities
DROP POLICY IF EXISTS "Users can delete own opportunities" ON public.opportunities;
DROP POLICY IF EXISTS "Users can insert own opportunities" ON public.opportunities;
DROP POLICY IF EXISTS "Users can update own opportunities" ON public.opportunities;
DROP POLICY IF EXISTS "Users can view own opportunities" ON public.opportunities;

CREATE POLICY "Users can view own opportunities"
  ON public.opportunities FOR SELECT TO authenticated
  USING (user_id = (SELECT auth.uid()));
CREATE POLICY "Users can insert own opportunities"
  ON public.opportunities FOR INSERT TO authenticated
  WITH CHECK (user_id = (SELECT auth.uid()));
CREATE POLICY "Users can update own opportunities"
  ON public.opportunities FOR UPDATE TO authenticated
  USING (user_id = (SELECT auth.uid()));
CREATE POLICY "Users can delete own opportunities"
  ON public.opportunities FOR DELETE TO authenticated
  USING (user_id = (SELECT auth.uid()));

-- opportunity_notes
DROP POLICY IF EXISTS "Users can delete their own notes" ON public.opportunity_notes;
DROP POLICY IF EXISTS "Users can insert their own notes" ON public.opportunity_notes;
DROP POLICY IF EXISTS "Users can update their own notes" ON public.opportunity_notes;
DROP POLICY IF EXISTS "Users can view their own notes" ON public.opportunity_notes;

CREATE POLICY "Users can view their own notes"
  ON public.opportunity_notes FOR SELECT TO authenticated
  USING (user_id = (SELECT auth.uid()));
CREATE POLICY "Users can insert their own notes"
  ON public.opportunity_notes FOR INSERT TO authenticated
  WITH CHECK (user_id = (SELECT auth.uid()));
CREATE POLICY "Users can update their own notes"
  ON public.opportunity_notes FOR UPDATE TO authenticated
  USING (user_id = (SELECT auth.uid()));
CREATE POLICY "Users can delete their own notes"
  ON public.opportunity_notes FOR DELETE TO authenticated
  USING (user_id = (SELECT auth.uid()));

-- profiles
DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;
CREATE POLICY "Users can view own profile"
  ON public.profiles FOR ALL TO authenticated
  USING (id = (SELECT auth.uid()))
  WITH CHECK (id = (SELECT auth.uid()));

-- shared_link_views
DROP POLICY IF EXISTS "Users can view own link views" ON public.shared_link_views;
CREATE POLICY "Users can view own link views"
  ON public.shared_link_views FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM shared_links sl
    WHERE sl.id = shared_link_views.shared_link_id
    AND sl.user_id = (SELECT auth.uid())
  ));

-- shared_links
DROP POLICY IF EXISTS "Users can delete own shared_links" ON public.shared_links;
DROP POLICY IF EXISTS "Users can insert own shared_links" ON public.shared_links;
DROP POLICY IF EXISTS "Users can update own shared_links" ON public.shared_links;
DROP POLICY IF EXISTS "Users can view own shared_links" ON public.shared_links;

CREATE POLICY "Users can view own shared_links"
  ON public.shared_links FOR SELECT TO authenticated
  USING (user_id = (SELECT auth.uid()));
CREATE POLICY "Users can insert own shared_links"
  ON public.shared_links FOR INSERT TO authenticated
  WITH CHECK (user_id = (SELECT auth.uid()));
CREATE POLICY "Users can update own shared_links"
  ON public.shared_links FOR UPDATE TO authenticated
  USING (user_id = (SELECT auth.uid()));
CREATE POLICY "Users can delete own shared_links"
  ON public.shared_links FOR DELETE TO authenticated
  USING (user_id = (SELECT auth.uid()));

-- subscriptions
DROP POLICY IF EXISTS "Users can view own subscription" ON public.subscriptions;
CREATE POLICY "Users can view own subscription"
  ON public.subscriptions FOR SELECT TO authenticated
  USING (user_id = (SELECT auth.uid()));

-- tailored_profiles
DROP POLICY IF EXISTS "Users can delete own tailored profiles" ON public.tailored_profiles;
DROP POLICY IF EXISTS "Users can insert own tailored profiles" ON public.tailored_profiles;
DROP POLICY IF EXISTS "Users can update own tailored profiles" ON public.tailored_profiles;
DROP POLICY IF EXISTS "Users can view own tailored profiles" ON public.tailored_profiles;

CREATE POLICY "Users can view own tailored profiles"
  ON public.tailored_profiles FOR SELECT TO authenticated
  USING (user_id = (SELECT auth.uid()));
CREATE POLICY "Users can insert own tailored profiles"
  ON public.tailored_profiles FOR INSERT TO authenticated
  WITH CHECK (user_id = (SELECT auth.uid()));
CREATE POLICY "Users can update own tailored profiles"
  ON public.tailored_profiles FOR UPDATE TO authenticated
  USING (user_id = (SELECT auth.uid()));
CREATE POLICY "Users can delete own tailored profiles"
  ON public.tailored_profiles FOR DELETE TO authenticated
  USING (user_id = (SELECT auth.uid()));

-- tailoring_eval_log
DROP POLICY IF EXISTS "Service role can manage all tailoring eval logs" ON public.tailoring_eval_log;
DROP POLICY IF EXISTS "Users can insert own tailoring eval logs" ON public.tailoring_eval_log;
DROP POLICY IF EXISTS "Users can view own tailoring eval logs" ON public.tailoring_eval_log;

CREATE POLICY "Service role can manage all tailoring eval logs"
  ON public.tailoring_eval_log FOR ALL TO public
  USING ((SELECT auth.jwt()) ->> 'role' = 'service_role')
  WITH CHECK ((SELECT auth.jwt()) ->> 'role' = 'service_role');
CREATE POLICY "Users can view own tailoring eval logs"
  ON public.tailoring_eval_log FOR SELECT TO authenticated
  USING (user_id = (SELECT auth.uid()));
CREATE POLICY "Users can insert own tailoring eval logs"
  ON public.tailoring_eval_log FOR INSERT TO authenticated
  WITH CHECK (user_id = (SELECT auth.uid()));

-- usage_tracking
DROP POLICY IF EXISTS "Users can view own usage" ON public.usage_tracking;
CREATE POLICY "Users can view own usage"
  ON public.usage_tracking FOR SELECT TO authenticated
  USING (user_id = (SELECT auth.uid()));

-- work_history
DROP POLICY IF EXISTS "Users can delete own work history" ON public.work_history;
DROP POLICY IF EXISTS "Users can insert own work history" ON public.work_history;
DROP POLICY IF EXISTS "Users can update own work history" ON public.work_history;
DROP POLICY IF EXISTS "Users can view own work history" ON public.work_history;

CREATE POLICY "Users can view own work history"
  ON public.work_history FOR SELECT TO authenticated
  USING (user_id = (SELECT auth.uid()));
CREATE POLICY "Users can insert own work history"
  ON public.work_history FOR INSERT TO authenticated
  WITH CHECK (user_id = (SELECT auth.uid()));
CREATE POLICY "Users can update own work history"
  ON public.work_history FOR UPDATE TO authenticated
  USING (user_id = (SELECT auth.uid()));
CREATE POLICY "Users can delete own work history"
  ON public.work_history FOR DELETE TO authenticated
  USING (user_id = (SELECT auth.uid()));
