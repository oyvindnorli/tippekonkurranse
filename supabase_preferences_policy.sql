-- ============================================
-- Add SELECT RLS Policy for user_preferences
-- ============================================
-- This allows users to read their own preferences

DROP POLICY IF EXISTS "Users can read own preferences" ON user_preferences;

CREATE POLICY "Users can read own preferences"
ON user_preferences
FOR SELECT
USING (auth.uid() = user_id);

-- ============================================
-- Verification
-- ============================================
-- Run this to verify all policies are in place:
-- SELECT * FROM pg_policies WHERE tablename = 'user_preferences';
