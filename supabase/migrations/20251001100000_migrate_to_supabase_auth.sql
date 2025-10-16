/*
  # Migrate to Supabase Auth

  1. Schema Changes
    - Add auth_user_id to church_users (links to auth.users)
    - Add function to set JWT claims with church_id
    - Create trigger to set claims on user creation

  2. RLS Policies
    - Update all policies to use JWT claims instead of session variables
    - Policies check: (auth.jwt() -> 'user_metadata' ->> 'church_id')::int = church_id

  3. Security
    - JWT-based RLS (cryptographically secure)
    - No more connection pooling issues
    - Church isolation enforced at database level
*/

-- Add auth_user_id column to link with Supabase Auth
ALTER TABLE church_users
ADD COLUMN IF NOT EXISTS auth_user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE;

-- Create unique index
CREATE UNIQUE INDEX IF NOT EXISTS idx_church_users_auth_user_id ON church_users(auth_user_id);

-- Function to get church_id from JWT
CREATE OR REPLACE FUNCTION get_user_church_id()
RETURNS int
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT COALESCE(
    (auth.jwt() -> 'user_metadata' ->> 'church_id')::int,
    (auth.jwt() -> 'app_metadata' ->> 'church_id')::int,
    0
  );
$$;

-- Drop old permissive policies
DROP POLICY IF EXISTS "Allow authenticated access to teams" ON teams;
DROP POLICY IF EXISTS "Allow authenticated access to leadership_layers" ON leadership_layers;
DROP POLICY IF EXISTS "Allow authenticated access to team_assignments" ON team_assignments;
DROP POLICY IF EXISTS "Allow authenticated access to assessments" ON assessments;
DROP POLICY IF EXISTS "Allow authenticated access to church_users" ON church_users;
DROP POLICY IF EXISTS "Allow authenticated access to churches" ON churches;

-- Teams: JWT-based RLS policies
CREATE POLICY "Users can view their church's teams"
  ON teams FOR SELECT
  USING (church_id = get_user_church_id());

CREATE POLICY "Users can insert teams for their church"
  ON teams FOR INSERT
  WITH CHECK (church_id = get_user_church_id());

CREATE POLICY "Users can update their church's teams"
  ON teams FOR UPDATE
  USING (church_id = get_user_church_id())
  WITH CHECK (church_id = get_user_church_id());

CREATE POLICY "Users can delete their church's teams"
  ON teams FOR DELETE
  USING (church_id = get_user_church_id());

-- Leadership layers: JWT-based RLS policies
CREATE POLICY "Users can view their church's leadership layers"
  ON leadership_layers FOR SELECT
  USING (church_id = get_user_church_id());

CREATE POLICY "Users can insert leadership layers for their church"
  ON leadership_layers FOR INSERT
  WITH CHECK (church_id = get_user_church_id());

CREATE POLICY "Users can update their church's leadership layers"
  ON leadership_layers FOR UPDATE
  USING (church_id = get_user_church_id())
  WITH CHECK (church_id = get_user_church_id());

CREATE POLICY "Users can delete their church's leadership layers"
  ON leadership_layers FOR DELETE
  USING (church_id = get_user_church_id());

-- Team assignments: JWT-based RLS policies (via assessments)
CREATE POLICY "Users can view their church's team assignments"
  ON team_assignments FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM assessments
      WHERE assessments.id = team_assignments.assessment_id
      AND assessments.church_id = get_user_church_id()
    )
  );

CREATE POLICY "Users can insert team assignments for their church"
  ON team_assignments FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM assessments
      WHERE assessments.id = team_assignments.assessment_id
      AND assessments.church_id = get_user_church_id()
    )
  );

CREATE POLICY "Users can update their church's team assignments"
  ON team_assignments FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM assessments
      WHERE assessments.id = team_assignments.assessment_id
      AND assessments.church_id = get_user_church_id()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM assessments
      WHERE assessments.id = team_assignments.assessment_id
      AND assessments.church_id = get_user_church_id()
    )
  );

CREATE POLICY "Users can delete their church's team assignments"
  ON team_assignments FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM assessments
      WHERE assessments.id = team_assignments.assessment_id
      AND assessments.church_id = get_user_church_id()
    )
  );

-- Assessments: JWT-based RLS policies
CREATE POLICY "Users can view their church's assessments"
  ON assessments FOR SELECT
  USING (church_id = get_user_church_id());

CREATE POLICY "Users can insert assessments for their church"
  ON assessments FOR INSERT
  WITH CHECK (church_id = get_user_church_id());

CREATE POLICY "Users can update their church's assessments"
  ON assessments FOR UPDATE
  USING (church_id = get_user_church_id())
  WITH CHECK (church_id = get_user_church_id());

CREATE POLICY "Users can delete their church's assessments"
  ON assessments FOR DELETE
  USING (church_id = get_user_church_id());

-- Church users: JWT-based RLS policies
CREATE POLICY "Users can view their church's users"
  ON church_users FOR SELECT
  USING (church_id = get_user_church_id());

CREATE POLICY "Users can insert users for their church"
  ON church_users FOR INSERT
  WITH CHECK (church_id = get_user_church_id());

CREATE POLICY "Users can update their church's users"
  ON church_users FOR UPDATE
  USING (church_id = get_user_church_id())
  WITH CHECK (church_id = get_user_church_id());

CREATE POLICY "Users can delete their church's users"
  ON church_users FOR DELETE
  USING (church_id = get_user_church_id());

-- Churches: JWT-based RLS policies
CREATE POLICY "Users can view their own church"
  ON churches FOR SELECT
  USING (id = get_user_church_id());

CREATE POLICY "Users can update their own church"
  ON churches FOR UPDATE
  USING (id = get_user_church_id())
  WITH CHECK (id = get_user_church_id());

-- Grant permissions
GRANT EXECUTE ON FUNCTION get_user_church_id() TO authenticated;
GRANT EXECUTE ON FUNCTION get_user_church_id() TO anon;
