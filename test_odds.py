#!/usr/bin/env python3
"""
Test script to fetch odds for a specific fixture
"""

import os
import requests
from dotenv import load_dotenv

load_dotenv()

API_FOOTBALL_KEY = os.getenv('API_FOOTBALL_KEY')
API_FOOTBALL_BASE = 'https://v3.football.api-sports.io'
API_FOOTBALL_HEADERS = {
    'x-apisports-key': API_FOOTBALL_KEY
}

def test_odds_fetch(fixture_id):
    """Test fetching odds for a specific fixture"""
    print(f"🔍 Testing odds fetch for fixture {fixture_id}...")

    url = f"{API_FOOTBALL_BASE}/odds"
    params = {
        'fixture': fixture_id
    }

    response = requests.get(url, headers=API_FOOTBALL_HEADERS, params=params)

    print(f"📡 Status code: {response.status_code}")

    if response.status_code != 200:
        print(f"❌ Error: {response.text}")
        return

    data = response.json()

    print(f"📦 Response keys: {data.keys()}")
    print(f"📊 Number of bookmakers: {len(data.get('response', []))}")

    if not data.get('response'):
        print("❌ No response data")
        return

    # Print full response structure for debugging
    import json
    print("\n📋 FULL RESPONSE STRUCTURE:")
    print(json.dumps(data['response'], indent=2))

    # Navigate the correct structure: response -> bookmakers array -> bets
    for response_item in data['response']:
        print(f"\n🔍 Response item keys: {response_item.keys()}")

        bookmakers = response_item.get('bookmakers', [])
        print(f"📊 Found {len(bookmakers)} bookmakers")

        for bookmaker in bookmakers:
            print(f"\n📚 Bookmaker: {bookmaker.get('name', 'Unknown')} (ID: {bookmaker.get('id')})")

            bets = bookmaker.get('bets', [])
            print(f"   Number of bets: {len(bets)}")

            for bet in bets:
                bet_name = bet.get('name', 'Unknown bet')

                if bet_name == 'Match Winner':
                    print(f"   🎲 Found Match Winner bet!")
                    values = bet.get('values', [])
                    print(f"      Found {len(values)} values:")
                    for v in values:
                        print(f"         {v.get('value', 'Unknown')}: {v.get('odd', 'N/A')}")

                    # Extract odds
                    if len(values) >= 3:
                        odds = {
                            'H': float(values[0]['odd']),
                            'U': float(values[1]['odd']),
                            'B': float(values[2]['odd'])
                        }
                        print(f"\n   ✅ EXTRACTED ODDS: H{odds['H']} U{odds['U']} B{odds['B']}")
                        return odds

    print("\n❌ No Match Winner odds found")
    return None

if __name__ == '__main__':
    # Test with the fixture you mentioned
    test_odds_fetch(1379079)
