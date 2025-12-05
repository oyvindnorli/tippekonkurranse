-- Supabase Schema for Tippekonkurranse
-- Run this in Supabase SQL Editor

-- 1. Users table (synced with Supabase Auth)
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  display_name TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Matches table (cached match data)
CREATE TABLE IF NOT EXISTS matches (
  id BIGINT PRIMARY KEY,
  home_team TEXT NOT NULL,
  away_team TEXT NOT NULL,
  league_id INTEGER NOT NULL,
  league_name TEXT,
  league_logo TEXT,
  round TEXT,
  season INTEGER NOT NULL,
  commence_time TIMESTAMPTZ NOT NULL,
  status TEXT NOT NULL,
  home_score INTEGER,
  away_score INTEGER,
  home_logo TEXT,
  away_logo TEXT,
  odds JSONB,
  completed BOOLEAN DEFAULT FALSE,
  elapsed INTEGER,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Tips table
CREATE TABLE IF NOT EXISTS tips (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE NOT NULL,
  match_id BIGINT REFERENCES matches(id) NOT NULL,
  home_score INTEGER NOT NULL,
  away_score INTEGER NOT NULL,
  home_team TEXT NOT NULL,
  away_team TEXT NOT NULL,
  odds JSONB,
  timestamp TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, match_id)
);

-- 4. Competitions table
CREATE TABLE IF NOT EXISTS competitions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  creator_id UUID REFERENCES users(id) NOT NULL,
  league_ids INTEGER[] NOT NULL,
  start_date TIMESTAMPTZ NOT NULL,
  end_date TIMESTAMPTZ NOT NULL,
  match_ids BIGINT[],
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. Competition participants
CREATE TABLE IF NOT EXISTS competition_participants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  competition_id UUID REFERENCES competitions(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE NOT NULL,
  user_name TEXT NOT NULL,
  joined_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(competition_id, user_id)
);

-- 6. User preferences
CREATE TABLE IF NOT EXISTS user_preferences (
  user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  selected_leagues INTEGER[],
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_tips_user_id ON tips(user_id);
CREATE INDEX IF NOT EXISTS idx_tips_match_id ON tips(match_id);
CREATE INDEX IF NOT EXISTS idx_tips_user_match ON tips(user_id, match_id);
CREATE INDEX IF NOT EXISTS idx_matches_status ON matches(status);
CREATE INDEX IF NOT EXISTS idx_matches_league ON matches(league_id);
CREATE INDEX IF NOT EXISTS idx_matches_season ON matches(season);
CREATE INDEX IF NOT EXISTS idx_matches_commence ON matches(commence_time);
CREATE INDEX IF NOT EXISTS idx_competition_participants_comp ON competition_participants(competition_id);
CREATE INDEX IF NOT EXISTS idx_competition_participants_user ON competition_participants(user_id);

-- Row Level Security (RLS) Policies

-- Users can read their own data
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can read own data" ON users
  FOR SELECT USING (auth.uid() = id);

-- Users can insert/update their own data
CREATE POLICY "Users can update own data" ON users
  FOR UPDATE USING (auth.uid() = id);

-- Tips policies
ALTER TABLE tips ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can read all tips" ON tips
  FOR SELECT USING (true);

CREATE POLICY "Users can insert own tips" ON tips
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own tips" ON tips
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own tips" ON tips
  FOR DELETE USING (auth.uid() = user_id);

-- Matches - everyone can read
ALTER TABLE matches ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can read matches" ON matches
  FOR SELECT USING (true);

-- Competitions - everyone can read
ALTER TABLE competitions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can read competitions" ON competitions
  FOR SELECT USING (true);

CREATE POLICY "Users can create competitions" ON competitions
  FOR INSERT WITH CHECK (auth.uid() = creator_id);

CREATE POLICY "Creators can update own competitions" ON competitions
  FOR UPDATE USING (auth.uid() = creator_id);

-- Competition participants
ALTER TABLE competition_participants ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can read participants" ON competition_participants
  FOR SELECT USING (true);

CREATE POLICY "Users can join competitions" ON competition_participants
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- User preferences
ALTER TABLE user_preferences ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can read own preferences" ON user_preferences
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can update own preferences" ON user_preferences
  FOR ALL USING (auth.uid() = user_id);

-- Useful views

-- View for tips with match details and calculated points
CREATE OR REPLACE VIEW tips_with_details AS
SELECT
  t.id,
  t.user_id,
  t.match_id,
  t.home_score AS tip_home_score,
  t.away_score AS tip_away_score,
  t.timestamp,
  m.home_team,
  m.away_team,
  m.home_score AS result_home_score,
  m.away_score AS result_away_score,
  m.status,
  m.commence_time,
  m.league_id,
  m.league_name,
  t.odds,
  m.completed,
  -- Calculate outcome
  CASE
    WHEN t.home_score > t.away_score THEN 'H'
    WHEN t.home_score < t.away_score THEN 'B'
    ELSE 'U'
  END AS tip_outcome,
  CASE
    WHEN m.home_score > m.away_score THEN 'H'
    WHEN m.home_score < m.away_score THEN 'B'
    WHEN m.home_score = m.away_score THEN 'U'
    ELSE NULL
  END AS result_outcome
FROM tips t
JOIN matches m ON t.match_id = m.id;

-- Helper function to calculate points
CREATE OR REPLACE FUNCTION calculate_tip_points(
  tip_home INTEGER,
  tip_away INTEGER,
  result_home INTEGER,
  result_away INTEGER,
  odds_json JSONB
) RETURNS NUMERIC AS $$
DECLARE
  points NUMERIC := 0;
  tip_outcome TEXT;
  result_outcome TEXT;
  outcome_odds NUMERIC := 2.0; -- default
BEGIN
  -- Return 0 if no result yet
  IF result_home IS NULL OR result_away IS NULL THEN
    RETURN 0;
  END IF;

  -- Determine outcomes
  tip_outcome := CASE
    WHEN tip_home > tip_away THEN 'H'
    WHEN tip_home < tip_away THEN 'B'
    ELSE 'U'
  END;

  result_outcome := CASE
    WHEN result_home > result_away THEN 'H'
    WHEN result_home < result_away THEN 'B'
    ELSE 'U'
  END;

  -- Get odds for the tipped outcome
  IF odds_json IS NOT NULL AND odds_json ? tip_outcome THEN
    outcome_odds := (odds_json ->> tip_outcome)::NUMERIC;
  END IF;

  -- Award points for correct outcome
  IF tip_outcome = result_outcome THEN
    points := points + outcome_odds;
  END IF;

  -- Award bonus for exact score
  IF tip_home = result_home AND tip_away = result_away THEN
    points := points + 3.0;
  END IF;

  RETURN points;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- View with calculated points
CREATE OR REPLACE VIEW tips_with_points AS
SELECT
  *,
  calculate_tip_points(
    tip_home_score,
    tip_away_score,
    result_home_score,
    result_away_score,
    odds
  ) AS points
FROM tips_with_details;

COMMENT ON TABLE users IS 'User accounts synced with Supabase Auth';
COMMENT ON TABLE matches IS 'Cached match data from API';
COMMENT ON TABLE tips IS 'User predictions for matches';
COMMENT ON TABLE competitions IS 'User-created competitions';
COMMENT ON TABLE competition_participants IS 'Users participating in competitions';
COMMENT ON TABLE user_preferences IS 'User preferences like selected leagues';
