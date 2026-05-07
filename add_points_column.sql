-- Legg til points-kolonne på tips-tabellen
-- Kjør i Supabase Dashboard → SQL Editor

ALTER TABLE tips ADD COLUMN IF NOT EXISTS points NUMERIC(6,2);

-- Index for raskere leaderboard-spørringer
CREATE INDEX IF NOT EXISTS idx_tips_user_points ON tips(user_id, points);
