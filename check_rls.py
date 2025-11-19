#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Check if RLS is blocking queries on matches table
"""

import os
import sys
import io
import requests
from dotenv import load_dotenv

# Force UTF-8 output encoding
if sys.platform == 'win32':
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')

load_dotenv()

SUPABASE_URL = 'https://ntbhjbstmbnfiaywfkkz.supabase.co'
SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im50YmhqYnN0bWJuZmlheXdma2t6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjMyOTYwNTAsImV4cCI6MjA3ODg3MjA1MH0.5R1QJZxXK5Rwdt2WPEKWAno1SBY6aFUQJPbwjOhar8E'

def test_anon_query():
    """Test query with anon key (what frontend uses)"""
    print("Testing query with ANON key (frontend)...")

    url = f"{SUPABASE_URL}/rest/v1/matches"
    headers = {
        'apikey': SUPABASE_ANON_KEY,
        'Authorization': f'Bearer {SUPABASE_ANON_KEY}'
    }

    params = {
        'select': 'id,home_team,away_team',
        'limit': 5
    }

    try:
        response = requests.get(url, headers=headers, params=params, timeout=10)

        print(f"Status code: {response.status_code}")
        print(f"Response: {response.text[:500]}")

        if response.status_code == 200:
            data = response.json()
            print(f"✅ SUCCESS! Got {len(data)} matches")
            return True
        else:
            print(f"❌ FAILED with status {response.status_code}")
            return False

    except requests.Timeout:
        print("❌ TIMEOUT after 10 seconds - this is the problem!")
        return False
    except Exception as e:
        print(f"❌ Exception: {e}")
        return False

def test_service_query():
    """Test query with service key (what backend uses)"""
    service_key = os.getenv('SUPABASE_SERVICE_KEY')

    if not service_key:
        print("\nSkipping service key test (SUPABASE_SERVICE_KEY not set)")
        return None

    print("\n" + "="*50)
    print("Testing query with SERVICE key (backend)...")

    url = f"{SUPABASE_URL}/rest/v1/matches"
    headers = {
        'apikey': service_key,
        'Authorization': f'Bearer {service_key}'
    }

    params = {
        'select': 'id,home_team,away_team',
        'limit': 5
    }

    try:
        response = requests.get(url, headers=headers, params=params, timeout=10)

        print(f"Status code: {response.status_code}")

        if response.status_code == 200:
            data = response.json()
            print(f"✅ SUCCESS! Got {len(data)} matches")
            return True
        else:
            print(f"❌ FAILED with status {response.status_code}")
            print(f"Response: {response.text[:500]}")
            return False

    except requests.Timeout:
        print("❌ TIMEOUT after 10 seconds")
        return False
    except Exception as e:
        print(f"❌ Exception: {e}")
        return False

if __name__ == '__main__':
    print("="*50)
    anon_ok = test_anon_query()
    service_ok = test_service_query()

    print("\n" + "="*50)
    print("DIAGNOSIS:")
    print("="*50)

    if anon_ok:
        print("✅ Anonymous queries work - no RLS problem")
    elif service_ok:
        print("❌ PROBLEM FOUND!")
        print("   - Service key works ✅")
        print("   - Anonymous key fails ❌")
        print("   → RLS is enabled but there's no policy for anonymous read!")
        print("\nFIX: Add RLS policy to allow anonymous SELECT on matches table")
    else:
        print("❌ Both keys fail - might be a network or Supabase issue")
