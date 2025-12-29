-- Test Fixtures for Integration Tests
-- These are applied after database reset to set up reference data needed by tests

-- Note: Test users are NOT created here - they are created via Supabase Auth API
-- in the test utilities (test-utils.ts) to properly trigger the auth flow
-- and auto-create profiles via the on_auth_user_created trigger.

-- Add any reference data that tests depend on below
-- For example, opportunity sources, predefined categories, etc.

-- Placeholder for future reference data
-- INSERT INTO public.some_reference_table (id, name) VALUES
--   ('ref-1', 'Reference Item 1'),
--   ('ref-2', 'Reference Item 2');

-- Verify the setup worked
DO $$
BEGIN
  RAISE NOTICE 'Test fixtures applied successfully';
END
$$;
