#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Beregner og lagrer poeng for alle tips på fullforte VM-kamper.
Kjores automatisk av GitHub Actions etter populate_vm2026.py.

Poengformel (samme som vm2026.js):
  - Riktig utfall (H/U/B): odds-verdi for utfallet
  - Eksakt resultat: +3 bonuspoeng
"""

import os
import sys
import io
import requests
from dotenv import load_dotenv

if sys.platform == 'win32':
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')

load_dotenv()

SUPABASE_URL = os.getenv('SUPABASE_URL', 'https://ntbhjbstmbnfiaywfkkz.supabase.co')
SUPABASE_SERVICE_KEY = os.getenv('SUPABASE_SERVICE_KEY')

WC_LEAGUE_ID = 1
WC_SEASON = 2026

HEADERS = {
    'apikey': SUPABASE_SERVICE_KEY,
    'Authorization': f'Bearer {SUPABASE_SERVICE_KEY}',
    'Content-Type': 'application/json'
}

DEFAULT_ODDS = {'H': 2.0, 'U': 3.0, 'B': 2.0}


def get_outcome(home, away):
    if home > away:
        return 'H'
    if home < away:
        return 'B'
    return 'U'


def calculate_points(tip_home, tip_away, result_home, result_away, odds):
    tip_outcome = get_outcome(tip_home, tip_away)
    result_outcome = get_outcome(result_home, result_away)
    points = 0.0

    if tip_outcome == result_outcome:
        points += float(odds.get(result_outcome, 2.0))

    if tip_home == result_home and tip_away == result_away:
        points += 3.0

    return round(points, 2)


def fetch_completed_matches():
    url = (f"{SUPABASE_URL}/rest/v1/matches"
           f"?league_id=eq.{WC_LEAGUE_ID}&season=eq.{WC_SEASON}"
           f"&completed=eq.true&select=id,home_score,away_score,odds")
    r = requests.get(url, headers=HEADERS)
    if r.status_code != 200:
        print(f"Feil ved henting av kamper: {r.status_code}")
        return []
    return r.json()


def fetch_tips_for_match(match_id):
    url = f"{SUPABASE_URL}/rest/v1/tips?match_id=eq.{match_id}&select=id,home_score,away_score,odds,points"
    r = requests.get(url, headers=HEADERS)
    if r.status_code != 200:
        return []
    return r.json()


def update_tip_points(tip_id, points):
    url = f"{SUPABASE_URL}/rest/v1/tips?id=eq.{tip_id}"
    r = requests.patch(url, headers=HEADERS, json={'points': points})
    return r.status_code in [200, 204]


def main():
    if not SUPABASE_SERVICE_KEY:
        print("Mangler SUPABASE_SERVICE_KEY")
        sys.exit(1)

    print("Beregner poeng for VM 2026-tips...")

    matches = fetch_completed_matches()
    if not matches:
        print("Ingen fullforte kamper funnet.")
        return

    print(f"Fant {len(matches)} fullforte kamper")

    updated = skipped = errors = 0

    for match in matches:
        mid = match['id']
        result_home = match.get('home_score')
        result_away = match.get('away_score')
        match_odds = match.get('odds') or DEFAULT_ODDS

        if result_home is None or result_away is None:
            continue

        tips = fetch_tips_for_match(mid)
        for tip in tips:
            points = calculate_points(
                tip['home_score'], tip['away_score'],
                result_home, result_away,
                tip.get('odds') or match_odds
            )

            if tip.get('points') == points:
                skipped += 1
                continue

            if update_tip_points(tip['id'], points):
                updated += 1
            else:
                errors += 1

    print(f"Ferdig — oppdatert: {updated} | uendret: {skipped} | feil: {errors}")


if __name__ == '__main__':
    main()
