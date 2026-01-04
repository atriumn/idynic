-- View for usage grouped by workflow (document or opportunity)
-- Note: job_id column added in later migration 20251229063013
CREATE OR REPLACE VIEW user_workflow_usage AS
WITH workflow_usage AS (
  SELECT
    user_id,
    COALESCE(document_id::text, opportunity_id::text, 'unknown') AS workflow_id,
    CASE
      WHEN document_id IS NOT NULL THEN 'resume'
      WHEN opportunity_id IS NOT NULL THEN 'opportunity'
      ELSE 'other'
    END AS workflow_type,
    MIN(created_at) AS started_at,
    MAX(created_at) AS completed_at,
    COUNT(*) AS operation_count,
    ARRAY_AGG(DISTINCT operation ORDER BY operation) AS operations,
    SUM(input_tokens + output_tokens) AS total_tokens,
    SUM(cost_cents) AS cost_cents,
    ROUND(SUM(cost_cents) / 100.0, 2) AS cost_dollars,
    ROUND(SUM(latency_ms) / 1000.0, 1) AS total_seconds,
    BOOL_AND(success) AS all_succeeded
  FROM ai_usage_log
  WHERE user_id IS NOT NULL
  GROUP BY user_id,
    COALESCE(document_id::text, opportunity_id::text, 'unknown'),
    CASE
      WHEN document_id IS NOT NULL THEN 'resume'
      WHEN opportunity_id IS NOT NULL THEN 'opportunity'
      ELSE 'other'
    END
)
SELECT
  w.*,
  COALESCE(d.filename, o.title, 'Unknown') AS workflow_name
FROM workflow_usage w
LEFT JOIN documents d ON w.workflow_type = 'resume' AND d.id::text = w.workflow_id
LEFT JOIN opportunities o ON w.workflow_type = 'opportunity' AND o.id::text = w.workflow_id
ORDER BY w.started_at DESC;
