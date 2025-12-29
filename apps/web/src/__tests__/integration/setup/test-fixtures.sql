-- Test Fixtures for Integration Tests
-- This file is applied after database reset to set up reference data needed by tests.
--
-- NOTE: Do NOT create users here - use the test utilities (createTestUser) instead
-- so that users are properly created via Supabase Auth with proper profiles.

-- Add any reference data that tests depend on here
-- For example, if you have lookup tables or configuration data

-- Example: If you have an opportunity_sources table
-- INSERT INTO public.opportunity_sources (id, name, type) VALUES
--   ('test-source-linkedin', 'Test LinkedIn', 'linkedin'),
--   ('test-source-indeed', 'Test Indeed', 'indeed')
-- ON CONFLICT (id) DO NOTHING;

-- Currently, the idynic schema doesn't have reference tables that need seeding.
-- The migrations create all necessary structures, and user data is created
-- dynamically in tests via the auth API.

SELECT 'Test fixtures applied' AS status;
