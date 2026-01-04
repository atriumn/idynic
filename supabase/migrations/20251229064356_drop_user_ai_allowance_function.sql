-- Drop deprecated user_ai_allowance function if it exists
-- This function was replaced by the views-based approach
DROP FUNCTION IF EXISTS public.user_ai_allowance(uuid);
DROP FUNCTION IF EXISTS public.get_user_ai_allowance(uuid);
