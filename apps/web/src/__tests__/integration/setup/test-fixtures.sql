-- Test Fixtures for Integration Tests
-- This file is applied after database reset to set up reference data

-- Note: We do NOT create test users here.
-- Test users are created programmatically via the Supabase auth API
-- so that proper auth tokens and sessions are generated.

-- Add any reference data that tests depend on below
-- (e.g., opportunity sources, categories, etc.)

-- Example: If you had an opportunity_sources table, you would seed it here:
-- INSERT INTO public.opportunity_sources (id, name, type) VALUES
--   ('test-source-linkedin', 'LinkedIn', 'linkedin'),
--   ('test-source-indeed', 'Indeed', 'indeed')
-- ON CONFLICT (id) DO NOTHING;

-- For now, we don't have any reference data that needs seeding.
-- The migrations create all necessary tables and the tests will
-- create their own test data.

SELECT 'Integration test fixtures applied' AS status;
