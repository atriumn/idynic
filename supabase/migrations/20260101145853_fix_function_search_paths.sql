-- Fix search_path for security on all public functions
-- This prevents potential security issues with unqualified object references

-- Update consume_beta_code to use empty search_path (SECURITY DEFINER functions)
CREATE OR REPLACE FUNCTION public.consume_beta_code(input_code text, user_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
declare
  code_record record;
begin
  select * into code_record
  from public.beta_codes
  where code = input_code
    and current_uses < max_uses
    and (expires_at is null or expires_at > now());

  if code_record is null then
    return false;
  end if;

  update public.beta_codes
  set current_uses = current_uses + 1
  where id = code_record.id;

  update public.profiles
  set beta_code_used = input_code
  where id = user_id;

  return true;
end;
$function$;
