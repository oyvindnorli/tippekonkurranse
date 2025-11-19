#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Migrate odds format from {home, draw, away} to {H, U, B}
"""

import os
import sys
import io
import requests
import json
from dotenv import load_dotenv

# Force UTF-8 output encoding
if sys.platform == 'win32':
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')

load_dotenv()

SUPABASE_URL = os.getenv('SUPABASE_URL', 'https://ntbhjbstmbnfiaywfkkz.supabase.co')
SUPABASE_SERVICE_KEY = os.getenv('SUPABASE_SERVICE_KEY')

def migrate_odds():
    """Migrate all odds from old format to new format"""

    if not SUPABASE_SERVICE_KEY:
        print("ERROR: SUPABASE_SERVICE_KEY not found in environment")
        print("This script requires service_role key to update matches")
        return

    url = f"{SUPABASE_URL}/rest/v1/matches"
    headers = {
        'apikey': SUPABASE_SERVICE_KEY,
        'Authorization': f'Bearer {SUPABASE_SERVICE_KEY}',
        'Content-Type': 'application/json'
    }

    # Get all matches with odds
    params = {
        'select': 'id,home_team,away_team,odds',
        'odds': 'not.is.null'
    }

    response = requests.get(url, headers=headers, params=params)

    if response.status_code != 200:
        print(f"Error fetching matches: {response.status_code}")
        print(response.text)
        return

    matches = response.json()
    print(f"Found {len(matches)} matches with odds to migrate\n")

    migrated = 0
    skipped = 0
    errors = 0

    for match in matches:
        match_id = match['id']
        old_odds = match['odds']

        # Check if already in new format
        if 'H' in old_odds:
            print(f"SKIP: {match['home_team']} - {match['away_team']} (already migrated)")
            skipped += 1
            continue

        # Check if in old format
        if 'home' not in old_odds:
            print(f"ERROR: {match['home_team']} - {match['away_team']} (unknown format: {list(old_odds.keys())})")
            errors += 1
            continue

        # Convert to new format
        new_odds = {
            'H': old_odds['home'],
            'U': old_odds['draw'],
            'B': old_odds['away']
        }

        # Update in database
        update_url = f"{url}?id=eq.{match_id}"
        update_data = {'odds': new_odds}

        response = requests.patch(update_url, headers=headers, json=update_data)

        if response.status_code in [200, 204]:
            print(f"✓ {match['home_team']} - {match['away_team']}")
            print(f"  Old: {json.dumps(old_odds)}")
            print(f"  New: {json.dumps(new_odds)}")
            migrated += 1
        else:
            print(f"ERROR updating {match_id}: {response.status_code}")
            print(response.text)
            errors += 1

    print(f"\n" + "="*50)
    print(f"Migration complete!")
    print(f"  Migrated: {migrated}")
    print(f"  Skipped (already migrated): {skipped}")
    print(f"  Errors: {errors}")
    print("="*50)

if __name__ == '__main__':
    migrate_odds()
