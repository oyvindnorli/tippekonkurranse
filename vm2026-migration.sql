-- VM 2026 Migration
-- Kjør dette i Supabase Dashboard → SQL Editor → New query
--
-- OBS: populate_vm2026.py (med service_role-nøkkel) håndterer kampinnsetting,
-- så du trenger IKKE gi brukere INSERT-tilgang til matches-tabellen.
-- Denne migrasjonen er minimal.

-- 1. Index for raskere VM-spørringer (league_id + season)
CREATE INDEX IF NOT EXISTS idx_matches_league_season ON matches(league_id, season);

-- 2. Sikre at Google-brukere kan opprette sin egen rad i users-tabellen
--    (Supabase-triggeren håndterer dette normalt, men denne er en fallback)
CREATE POLICY IF NOT EXISTS "Users can insert own record" ON users
  FOR INSERT WITH CHECK (auth.uid() = id);

-- Det er alt! Kjør deretter populate_vm2026.py for å hente inn VM-kampene:
--   python populate_vm2026.py          (henter kamper)
--   python populate_vm2026.py --odds   (henter kamper + odds)
