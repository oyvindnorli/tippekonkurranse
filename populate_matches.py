#!/usr/bin/env python3
"""
Admin script for populating matches in Supabase
This script uses the service_role key to write matches to Supabase.

Usage:
    python populate_matches.py

Environment variables:
    SUPABASE_URL - Your Supabase project URL
    SUPABASE_SERVICE_KEY - Your Supabase service_role key (NOT anon key!)
    API_FOOTBALL_KEY - Your API-Football API key

Or create a .env file with these variables.
"""

import os
import sys
import requests
from datetime import datetime, timedelta
from dotenv import load_dotenv

# Load environment variables from .env file
load_dotenv()

# Configuration
SUPABASE_URL = os.getenv('SUPABASE_URL', 'https://ntbhjbstmbnfiaywfkkz.supabase.co')
SUPABASE_SERVICE_KEY = os.getenv('SUPABASE_SERVICE_KEY')
API_FOOTBALL_KEY = os.getenv('API_FOOTBALL_KEY')

# League IDs to fetch
LEAGUES = [39, 2, 3, 135, 48]  # Premier League, Champions League, Europa League, Serie A, EFL Cup

# API-Football endpoints
API_FOOTBALL_BASE = 'https://v3.football.api-sports.io'
API_FOOTBALL_HEADERS = {
    'x-apisports-key': API_FOOTBALL_KEY
}

def check_env_vars():
    """Check if all required environment variables are set"""
    missing = []
    if not SUPABASE_SERVICE_KEY:
        missing.append('SUPABASE_SERVICE_KEY')
    if not API_FOOTBALL_KEY:
        missing.append('API_FOOTBALL_KEY')

    if missing:
        print(f"❌ Missing environment variables: {', '.join(missing)}")
        print("\nPlease set them in a .env file or as environment variables:")
        print("  SUPABASE_URL=https://ntbhjbstmbnfiaywfkkz.supabase.co")
        print("  SUPABASE_SERVICE_KEY=your_service_role_key_here")
        print("  API_FOOTBALL_KEY=your_api_football_key_here")
        sys.exit(1)

def fetch_fixtures(date_from, date_to, league_id):
    """Fetch fixtures from API-Football for a specific league"""
    url = f"{API_FOOTBALL_BASE}/fixtures"
    params = {
        'league': league_id,
        'season': 2025,
        'from': date_from,
        'to': date_to
    }

    response = requests.get(url, headers=API_FOOTBALL_HEADERS, params=params)

    if response.status_code != 200:
        print(f"❌ API-Football error: {response.status_code}")
        return []

    data = response.json()
    return data.get('response', [])

def fetch_odds(fixture_id):
    """Fetch odds for a specific fixture"""
    url = f"{API_FOOTBALL_BASE}/odds"
    params = {
        'fixture': fixture_id
    }

    response = requests.get(url, headers=API_FOOTBALL_HEADERS, params=params)

    if response.status_code != 200:
        print(f"      ⚠️ Odds API error {response.status_code} for fixture {fixture_id}")
        return None

    data = response.json()
    if not data.get('response') or len(data['response']) == 0:
        print(f"      ⚠️ No odds data for fixture {fixture_id}")
        return None

    # Navigate correct structure: response -> bookmakers array -> bets
    for response_item in data['response']:
        bookmakers = response_item.get('bookmakers', [])

        for bookmaker in bookmakers:
            bookmaker_name = bookmaker.get('name', 'Unknown')

            for bet in bookmaker.get('bets', []):
                if bet.get('name') == 'Match Winner':
                    values = bet.get('values', [])
                    if len(values) >= 3:
                        odds = {
                            'home': float(values[0]['odd']),
                            'draw': float(values[1]['odd']),
                            'away': float(values[2]['odd'])
                        }
                        print(f"      ✅ Odds from {bookmaker_name}: H{odds['home']} D{odds['draw']} A{odds['away']}")
                        return odds

    print(f"      ⚠️ No Match Winner odds found for fixture {fixture_id}")
    return None

def transform_fixture(fixture, odds=None):
    """Transform API-Football fixture to Supabase format"""
    teams = fixture['teams']
    league = fixture['league']
    fixture_data = fixture['fixture']
    goals = fixture.get('goals', {})

    # Determine if match is completed
    status = fixture_data.get('status', {}).get('short', 'NS')
    completed = status in ['FT', 'AET', 'PEN']

    return {
        'id': fixture_data['id'],
        'home_team': teams['home']['name'],
        'away_team': teams['away']['name'],
        'home_logo': teams['home']['logo'],
        'away_logo': teams['away']['logo'],
        'commence_time': fixture_data['date'],
        'league_id': league['id'],
        'league_name': league['name'],
        'season': league.get('season', 2025),
        'status': status,
        'home_score': goals.get('home'),
        'away_score': goals.get('away'),
        'odds': odds,
        'completed': completed,
        'elapsed': fixture_data.get('status', {}).get('elapsed')
    }

def save_matches_to_supabase(matches):
    """Save matches to Supabase using service_role key"""
    url = f"{SUPABASE_URL}/rest/v1/matches"
    headers = {
        'apikey': SUPABASE_SERVICE_KEY,
        'Authorization': f'Bearer {SUPABASE_SERVICE_KEY}',
        'Content-Type': 'application/json',
        'Prefer': 'resolution=merge-duplicates'
    }

    saved_count = 0
    error_count = 0

    for match in matches:
        # Try to upsert (insert or update)
        response = requests.post(url, headers=headers, json=match)

        if response.status_code in [200, 201]:
            saved_count += 1
            print(f"✅ Saved: {match['home_team']} - {match['away_team']}")
        else:
            error_count += 1
            print(f"❌ Error saving match {match['id']}: {response.status_code} - {response.text}")

    return saved_count, error_count

def main():
    """Main function to fetch and save matches"""
    print("🚀 Starting match population script...")

    # Check environment variables
    check_env_vars()

    # Calculate date range (today to 30 days from now)
    today = datetime.now().strftime('%Y-%m-%d')
    future = (datetime.now() + timedelta(days=30)).strftime('%Y-%m-%d')

    print(f"📅 Fetching matches from {today} to {future}")
    print(f"🏆 Leagues: {LEAGUES}")

    all_matches = []

    # Fetch fixtures for each league
    for league_id in LEAGUES:
        print(f"\n🔍 Fetching league {league_id}...")
        fixtures = fetch_fixtures(today, future, league_id)
        print(f"   Found {len(fixtures)} fixtures")

        # Fetch odds and transform each fixture
        for fixture in fixtures:
            fixture_id = fixture['fixture']['id']

            # Fetch odds
            odds = fetch_odds(fixture_id)
            if odds:
                print(f"   📊 Odds found for {fixture['teams']['home']['name']} - {fixture['teams']['away']['name']}")

            # Transform and add to list
            match = transform_fixture(fixture, odds)
            all_matches.append(match)

    print(f"\n💾 Total matches to save: {len(all_matches)}")

    if not all_matches:
        print("ℹ️ No matches found. Exiting.")
        return

    # Save to Supabase
    print("\n📤 Saving matches to Supabase...")
    saved, errors = save_matches_to_supabase(all_matches)

    print(f"\n✅ Saved {saved} matches")
    if errors > 0:
        print(f"❌ Failed to save {errors} matches")

    print("\n🎉 Done!")

if __name__ == '__main__':
    main()
