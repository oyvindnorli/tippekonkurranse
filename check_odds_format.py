#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Check what format odds are stored in Supabase
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

SUPABASE_URL = 'https://ntbhjbstmbnfiaywfkkz.supabase.co'
SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im50YmhqYnN0bWJuZmlheXdma2t6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjMyOTYwNTAsImV4cCI6MjA3ODg3MjA1MH0.5R1QJZxXK5Rwdt2WPEKWAno1SBY6aFUQJPbwjOhar8E'

def check_odds_format():
    """Check the format of odds in database"""
    url = f"{SUPABASE_URL}/rest/v1/matches"
    headers = {
        'apikey': SUPABASE_ANON_KEY,
        'Authorization': f'Bearer {SUPABASE_ANON_KEY}'
    }

    # Get matches with odds
    params = {
        'select': 'id,home_team,away_team,odds,commence_time',
        'odds': 'not.is.null',
        'order': 'commence_time.asc',
        'limit': 10
    }

    response = requests.get(url, headers=headers, params=params)

    if response.status_code != 200:
        print(f"Error: {response.status_code}")
        print(response.text)
        return

    matches = response.json()

    print(f"Found {len(matches)} matches with odds\n")

    for match in matches:
        print(f"Match: {match['home_team']} - {match['away_team']}")
        print(f"  Odds: {json.dumps(match['odds'], indent=2)}")

        # Check format
        if match['odds']:
            if 'H' in match['odds']:
                print("  Format: CORRECT (H/U/B)")
            elif 'home' in match['odds']:
                print("  Format: WRONG (home/draw/away) - needs migration!")
            else:
                print(f"  Format: UNKNOWN - keys are {list(match['odds'].keys())}")
        print()

if __name__ == '__main__':
    check_odds_format()
