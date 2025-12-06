-- Migration: Add round and league_logo columns to matches table
-- Run this in Supabase SQL Editor

-- Add league_logo column (to store league logo URL)
ALTER TABLE matches
ADD COLUMN IF NOT EXISTS league_logo TEXT;

-- Add round column (to store round/gameweek info like "Regular Season - 15")
ALTER TABLE matches
ADD COLUMN IF NOT EXISTS round TEXT;

-- Optional: Create index on round for faster queries when grouping by round
CREATE INDEX IF NOT EXISTS idx_matches_round ON matches(round);

-- IMPORTANT: Add UPDATE policy for matches table
-- Without this, RLS blocks all updates even though reads are allowed
DROP POLICY IF EXISTS "Anyone can update matches" ON matches;
CREATE POLICY "Anyone can update matches" ON matches
  FOR UPDATE USING (true);

-- Verify the columns were added
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'matches'
AND column_name IN ('round', 'league_logo');
