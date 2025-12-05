# Database Migration Guide

## Adding Round and League Logo Support

### Problem
Matches in the app showed "Liga undefined - Ukjent runde" because the `round` and `league_logo` columns were missing from the Supabase `matches` table.

### Solution
Add the missing columns to the database.

---

## How to Apply the Migration

### Step 1: Open Supabase SQL Editor
1. Go to [Supabase Dashboard](https://supabase.com/dashboard)
2. Select your project: **ntbhjbstmbnfiaywfkkz**
3. Click on **SQL Editor** in the left sidebar

### Step 2: Run the Migration
1. Open the file `supabase-migration-add-round.sql`
2. Copy all the SQL code
3. Paste it into the Supabase SQL Editor
4. Click **Run** button

### Step 3: Verify
The script will show the newly added columns:

```
column_name  | data_type | is_nullable
-------------|-----------|------------
round        | text      | YES
league_logo  | text      | YES
```

### Step 4: Refresh Match Data
After applying the migration, you need to refresh the match data so the new fields get populated:

**Option A: Wait for automatic refresh** (matches update periodically)

**Option B: Manual refresh** (faster):
1. Log in to the app
2. Open browser console (F12)
3. Run: `localStorage.clear()`
4. Reload the page

The app will fetch fresh match data from the API with round information and save it to Supabase with the new fields.

---

## What Changed

### Database Schema
- Added `round TEXT` column to `matches` table
- Added `league_logo TEXT` column to `matches` table
- Added index on `round` column for faster queries

### Code Changes
- `supabase-schema.sql` - Updated schema definition
- `js/utils/matchCache.js` - Now saves `round` and `league_logo` when inserting matches
- `js/utils/matchCache.js` - `convertSupabaseMatch()` already maps these fields

### Result
- Matches now display properly grouped by league and round: **"⚽ Premier League - Regular Season - 15"**
- No more "Liga undefined - Ukjent runde" errors
- Consistent with how competitions page groups matches

---

## Rollback (if needed)

If you need to remove these columns:

```sql
ALTER TABLE matches DROP COLUMN IF EXISTS round;
ALTER TABLE matches DROP COLUMN IF EXISTS league_logo;
DROP INDEX IF EXISTS idx_matches_round;
```

---

## Technical Notes

- The `round` field comes from API-Football's `fixture.league.round` field
- Format varies by league: `"Regular Season - 15"` (Premier League), `"Group Stage - 1"` (Champions League), etc.
- The `league_logo` field is the URL to the league's logo image
- Both fields are optional (nullable) so existing matches won't break
