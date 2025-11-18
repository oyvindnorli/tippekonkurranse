-- ============================================
-- Supabase RLS Policy Fix for Matches Table
-- ============================================
-- This allows:
-- - Everyone can READ matches (anonymous + authenticated)
-- - Only service_role can WRITE matches (admin scripts)
-- ============================================

-- First, drop existing policies if they exist
DROP POLICY IF EXISTS "Anyone can read matches" ON matches;
DROP POLICY IF EXISTS "Service role can insert matches" ON matches;
DROP POLICY IF EXISTS "Service role can update matches" ON matches;
DROP POLICY IF EXISTS "Service role can delete matches" ON matches;

-- Enable RLS on matches table
ALTER TABLE matches ENABLE ROW LEVEL SECURITY;

-- ============================================
-- READ Policy: Allow everyone to read matches
-- ============================================
CREATE POLICY "Anyone can read matches"
ON matches
FOR SELECT
TO public
USING (true);

-- ============================================
-- WRITE Policies: Only service_role can write
-- ============================================
-- Note: These policies only apply to regular users (authenticated + anon)
-- The service_role bypasses RLS entirely, so it can always write

-- Block INSERT for regular users (only service_role can insert)
CREATE POLICY "Service role can insert matches"
ON matches
FOR INSERT
TO authenticated, anon
WITH CHECK (false);

-- Block UPDATE for regular users (only service_role can update)
CREATE POLICY "Service role can update matches"
ON matches
FOR UPDATE
TO authenticated, anon
USING (false)
WITH CHECK (false);

-- Block DELETE for regular users (only service_role can delete)
CREATE POLICY "Service role can delete matches"
ON matches
FOR DELETE
TO authenticated, anon
USING (false);

-- ============================================
-- Verification queries
-- ============================================
-- Run these to verify the policies are in place:
-- SELECT * FROM pg_policies WHERE tablename = 'matches';
