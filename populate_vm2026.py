#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
VM 2026 - Script for å hente og lagre VM-kamper i Supabase
Kjøres manuelt (og periodisk under turneringen for å oppdatere resultater).

Bruk:
    python populate_vm2026.py           # Hent alle kamper + oppdater resultater
    python populate_vm2026.py --odds    # Hent odds i tillegg (bruker ekstra API-kall)

Krever .env-fil med:
    SUPABASE_SERVICE_KEY=din_service_role_nøkkel
    API_FOOTBALL_KEY=din_api_football_nøkkel
"""

import os
import sys
import io
import json
import argparse
import requests
from datetime import datetime
from dotenv import load_dotenv

if sys.platform == 'win32':
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')

load_dotenv()

SUPABASE_URL = os.getenv('SUPABASE_URL', 'https://ntbhjbstmbnfiaywfkkz.supabase.co')
SUPABASE_SERVICE_KEY = os.getenv('SUPABASE_SERVICE_KEY')
API_FOOTBALL_KEY = os.getenv('API_FOOTBALL_KEY')

WC_LEAGUE_ID = 1
WC_SEASON = 2026
WC_FROM = '2026-06-11'
WC_TO = '2026-07-19'

API_BASE = 'https://v3.football.api-sports.io'
API_HEADERS = lambda: {'x-apisports-key': API_FOOTBALL_KEY}

SUPABASE_HEADERS = lambda: {
    'apikey': SUPABASE_SERVICE_KEY,
    'Authorization': f'Bearer {SUPABASE_SERVICE_KEY}',
    'Content-Type': 'application/json'
}


def check_env():
    missing = [v for v in ['SUPABASE_SERVICE_KEY', 'API_FOOTBALL_KEY'] if not os.getenv(v)]
    if missing:
        print(f"❌ Manglende miljøvariabler: {', '.join(missing)}")
        print("\nOpprett .env-fil med:")
        print("  SUPABASE_SERVICE_KEY=din_service_role_nøkkel")
        print("  API_FOOTBALL_KEY=din_api_football_nøkkel")
        sys.exit(1)


def fetch_fixtures():
    """Hent alle VM-kamper fra API-Football"""
    print(f"📡 Henter VM 2026-kamper (liga={WC_LEAGUE_ID}, sesong={WC_SEASON})...")
    url = f"{API_BASE}/fixtures"
    params = {'league': WC_LEAGUE_ID, 'season': WC_SEASON, 'from': WC_FROM, 'to': WC_TO}
    r = requests.get(url, headers=API_HEADERS(), params=params)
    if r.status_code != 200:
        print(f"❌ API-Football feil: {r.status_code} - {r.text[:200]}")
        return []
    data = r.json()
    fixtures = data.get('response', [])
    print(f"   Fant {len(fixtures)} kamper")
    return fixtures


def fetch_odds(fixture_id):
    """Hent odds for én kamp"""
    r = requests.get(f"{API_BASE}/odds", headers=API_HEADERS(), params={'fixture': fixture_id})
    if r.status_code != 200:
        return None
    data = r.json()
    for item in data.get('response', []):
        for bookmaker in item.get('bookmakers', []):
            for bet in bookmaker.get('bets', []):
                if bet.get('name') == 'Match Winner':
                    vals = bet.get('values', [])
                    if len(vals) >= 3:
                        try:
                            return {
                                'H': round(float(vals[0]['odd']), 2),
                                'U': round(float(vals[1]['odd']), 2),
                                'B': round(float(vals[2]['odd']), 2)
                            }
                        except (ValueError, KeyError):
                            pass
    return None


def transform(fixture, odds=None):
    """Konverter API-Football-fixture til Supabase-format"""
    f = fixture['fixture']
    t = fixture['teams']
    l = fixture['league']
    g = fixture.get('goals', {})
    status = f.get('status', {}).get('short', 'NS')
    completed = status in ['FT', 'AET', 'PEN', 'FT_PEN']

    return {
        'id': f['id'],
        'home_team': t['home']['name'],
        'away_team': t['away']['name'],
        'home_logo': t['home'].get('logo'),
        'away_logo': t['away'].get('logo'),
        'commence_time': f['date'],
        'league_id': WC_LEAGUE_ID,
        'league_name': 'FIFA World Cup',
        'round': l.get('round'),
        'season': WC_SEASON,
        'status': status,
        'home_score': g.get('home'),
        'away_score': g.get('away'),
        'completed': completed,
        'elapsed': f.get('status', {}).get('elapsed'),
        'odds': odds
    }


def upsert_matches(matches, fetch_odds_flag):
    """Lagre/oppdater kamper i Supabase"""
    url = f"{SUPABASE_URL}/rest/v1/matches"
    saved = errors = 0

    for m in matches:
        mid = m['id']

        # Sjekk om kampen finnes
        r = requests.get(f"{url}?id=eq.{mid}&select=id,odds,completed",
                         headers=SUPABASE_HEADERS())
        existing = r.json() if r.status_code == 200 else []

        if existing:
            ex = existing[0]
            updates = {'updated_at': datetime.now().isoformat(), 'status': m['status']}

            if m['home_score'] is not None:
                updates.update({
                    'home_score': m['home_score'],
                    'away_score': m['away_score'],
                    'completed': m['completed'],
                    'elapsed': m.get('elapsed')
                })

            # Hent odds om flagget er satt og odds mangler
            if fetch_odds_flag and ex.get('odds') is None and not m['completed']:
                odds = fetch_odds(mid)
                if odds:
                    updates['odds'] = odds
                    print(f"   📈 Odds lagt til: {m['home_team']} - {m['away_team']} | H{odds['H']} U{odds['U']} B{odds['B']}")

            r2 = requests.patch(f"{url}?id=eq.{mid}", headers=SUPABASE_HEADERS(), json=updates)
            if r2.status_code in [200, 204]:
                status_icon = '✅' if m['completed'] else '🔄'
                print(f"   {status_icon} Oppdatert: {m['home_team']} {m['home_score'] or '?'}–{m['away_score'] or '?'} {m['away_team']}")
                saved += 1
            else:
                print(f"   ❌ Feil ved oppdatering av {mid}: {r2.status_code}")
                errors += 1

        else:
            # Ny kamp — hent odds om aktuelt
            if fetch_odds_flag and not m['completed']:
                odds = fetch_odds(mid)
                if odds:
                    m['odds'] = odds
                    print(f"   📈 Odds hentet: {m['home_team']} - {m['away_team']} | H{odds['H']} U{odds['U']} B{odds['B']}")

            r2 = requests.post(url, headers=SUPABASE_HEADERS(), json=m)
            if r2.status_code in [200, 201]:
                print(f"   ✅ Lagt inn: {m['home_team']} - {m['away_team']} ({m['round']})")
                saved += 1
            else:
                print(f"   ❌ Feil ved innsetting av {mid}: {r2.status_code} - {r2.text[:100]}")
                errors += 1

    return saved, errors


def print_summary(fixtures):
    """Skriv ut en kort statistikk etter henting"""
    total = len(fixtures)
    completed = sum(1 for f in fixtures if f['fixture']['status']['short'] in ['FT', 'AET', 'PEN'])
    upcoming = sum(1 for f in fixtures if f['fixture']['status']['short'] == 'NS')
    rounds = set(f['league']['round'] for f in fixtures)
    print(f"\n📊 Oversikt:")
    print(f"   Totalt: {total} kamper")
    print(f"   Fullført: {completed}")
    print(f"   Kommende: {upcoming}")
    print(f"   Runder: {', '.join(sorted(rounds))}")


def main():
    parser = argparse.ArgumentParser(description='Populate VM 2026 matches in Supabase')
    parser.add_argument('--odds', action='store_true', help='Hent odds fra API (bruker ekstra API-kall)')
    args = parser.parse_args()

    print("🏆 VM 2026 - Populate script")
    print("=" * 45)

    check_env()

    fixtures = fetch_fixtures()
    if not fixtures:
        print("ℹ️  Ingen kamper funnet. API-Football kan ha begrenset tilgang til VM-data.")
        print("    Prøv igjen nærmere turneringen (11. juni 2026).")
        return

    print_summary(fixtures)

    if args.odds:
        print("\n⚠️  --odds flagget er satt: henter odds for alle kommende kamper.")
        print("    Dette bruker mange API-kall. Bruk sparsomt!")

    print(f"\n💾 Lagrer {len(fixtures)} kamper til Supabase...")
    matches = [transform(f) for f in fixtures]
    saved, errors = upsert_matches(matches, args.odds)

    print(f"\n{'=' * 45}")
    print(f"✅ Ferdig! Lagret/oppdatert: {saved} | Feil: {errors}")
    if errors:
        print("   Sjekk at SUPABASE_SERVICE_KEY er korrekt service_role-nøkkel (ikke anon-nøkkelen).")


if __name__ == '__main__':
    main()
