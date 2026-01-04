-- Enable RLS on ai_usage_log and move vector extension
-- Note: Some of these changes may have been applied directly to prod on 2026-01-03.
-- This migration is idempotent to handle that case.

-- 1. Enable RLS on ai_usage_log (idempotent - no error if already enabled)
ALTER TABLE public.ai_usage_log ENABLE ROW LEVEL SECURITY;

-- 2. Create service role policy (will be replaced by performance-optimized version in next migration)
-- Using DO block to check if policy exists first
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies
        WHERE schemaname = 'public'
        AND tablename = 'ai_usage_log'
        AND policyname = 'Service role can manage all ai usage logs'
    ) THEN
        CREATE POLICY "Service role can manage all ai usage logs"
            ON public.ai_usage_log
            FOR ALL
            TO public
            USING ((auth.jwt() ->> 'role'::text) = 'service_role'::text)
            WITH CHECK ((auth.jwt() ->> 'role'::text) = 'service_role'::text);
    END IF;
END
$$;

-- 3. Move vector extension from public to extensions schema (idempotent)
DO $$
BEGIN
    -- Only move if currently in public schema
    IF EXISTS (
        SELECT 1 FROM pg_extension e
        JOIN pg_namespace n ON n.oid = e.extnamespace
        WHERE e.extname = 'vector' AND n.nspname = 'public'
    ) THEN
        ALTER EXTENSION vector SET SCHEMA extensions;
    END IF;
END
$$;
