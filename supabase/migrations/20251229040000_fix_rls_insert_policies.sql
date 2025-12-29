-- Fix RLS policies to use explicit INSERT policies with WITH CHECK
-- The original "for all using" policies don't properly handle INSERT operations
-- in all PostgreSQL/Supabase versions. This migration drops the old policies
-- and creates explicit per-operation policies.

-- ============================================================================
-- DOCUMENTS TABLE
-- ============================================================================

-- Drop the existing policy
drop policy if exists "Users can manage own documents" on documents;

-- Create explicit per-operation policies
create policy "Users can view own documents"
  on documents for select
  using (auth.uid() = user_id);

create policy "Users can insert own documents"
  on documents for insert
  with check (auth.uid() = user_id);

create policy "Users can update own documents"
  on documents for update
  using (auth.uid() = user_id);

create policy "Users can delete own documents"
  on documents for delete
  using (auth.uid() = user_id);

-- ============================================================================
-- CLAIMS TABLE
-- ============================================================================

-- Drop the existing policy
drop policy if exists "Users can manage own claims" on claims;

-- Create explicit per-operation policies
create policy "Users can view own claims"
  on claims for select
  using (auth.uid() = user_id);

create policy "Users can insert own claims"
  on claims for insert
  with check (auth.uid() = user_id);

create policy "Users can update own claims"
  on claims for update
  using (auth.uid() = user_id);

create policy "Users can delete own claims"
  on claims for delete
  using (auth.uid() = user_id);

-- ============================================================================
-- OPPORTUNITIES TABLE
-- ============================================================================

-- Drop the existing policy
drop policy if exists "Users can manage own opportunities" on opportunities;

-- Create explicit per-operation policies
create policy "Users can view own opportunities"
  on opportunities for select
  using (auth.uid() = user_id);

create policy "Users can insert own opportunities"
  on opportunities for insert
  with check (auth.uid() = user_id);

create policy "Users can update own opportunities"
  on opportunities for update
  using (auth.uid() = user_id);

create policy "Users can delete own opportunities"
  on opportunities for delete
  using (auth.uid() = user_id);

-- ============================================================================
-- MATCHES TABLE
-- ============================================================================

-- Drop the existing policy
drop policy if exists "Users can manage own matches" on matches;

-- Create explicit per-operation policies
create policy "Users can view own matches"
  on matches for select
  using (auth.uid() = user_id);

create policy "Users can insert own matches"
  on matches for insert
  with check (auth.uid() = user_id);

create policy "Users can update own matches"
  on matches for update
  using (auth.uid() = user_id);

create policy "Users can delete own matches"
  on matches for delete
  using (auth.uid() = user_id);
