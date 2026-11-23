#!/usr/bin/env python3
"""
Active User Counter

Counts active users on the hosted FeedOwn server (self-hosted instances are
not visible here). Test accounts (user_profiles.is_test_account) are excluded.

Two signals:
  - Readers:   users who marked an article as read (read_articles.read_at).
               The best signal for "actually used the app", but read_articles
               rows are deleted together with expired articles (7-day TTL),
               so only the last ~7 days can be counted.
  - Refreshed: users whose feeds were fetched (feeds.last_fetched_at).
               Since mobile 1.0.15 this includes background refresh, so it
               counts users who still have the app installed, not only those
               who opened it.

Usage:
  python scripts/check_active_users.py
"""

import os
import sys
from datetime import datetime, timezone, timedelta
from dotenv import load_dotenv
from supabase import create_client, Client

# Fix Windows console encoding
if sys.platform == 'win32':
    sys.stdout.reconfigure(encoding='utf-8', errors='replace')
    sys.stderr.reconfigure(encoding='utf-8', errors='replace')

# Load environment variables
env_path = os.path.join(os.path.dirname(__file__), '..', '.env.shared')
load_dotenv(env_path)

if not os.getenv('SUPABASE_URL'):
    env_path_parent = os.path.join(os.path.dirname(__file__), '..', '.env')
    load_dotenv(env_path_parent)

SUPABASE_URL = os.getenv('SUPABASE_URL') or os.getenv('VITE_SUPABASE_URL')
SUPABASE_SERVICE_ROLE_KEY = os.getenv('SUPABASE_SERVICE_ROLE_KEY')

if not SUPABASE_URL or not SUPABASE_SERVICE_ROLE_KEY:
    print("Error: SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required")
    print("Set them in .env.shared or as environment variables")
    sys.exit(1)

supabase: Client = create_client(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

PAGE_SIZE = 1000  # PostgREST returns at most 1000 rows per request


def parse_dt(s):
    if not s:
        return None
    try:
        return datetime.fromisoformat(str(s).replace('Z', '+00:00'))
    except ValueError:
        return None


def fetch_all(table, columns, time_column, since):
    """Fetch every row with time_column >= since, paging past the 1000-row cap."""
    rows = []
    start = 0
    while True:
        res = (
            supabase.table(table)
            .select(columns)
            .gte(time_column, since.isoformat())
            .order(time_column)
            .range(start, start + PAGE_SIZE - 1)
            .execute()
        )
        rows.extend(res.data)
        if len(res.data) < PAGE_SIZE:
            return rows
        start += PAGE_SIZE


def last_seen_by_user(rows, time_column, excluded):
    """Map user_id -> latest timestamp, skipping excluded users."""
    latest = {}
    for row in rows:
        uid = row['user_id']
        if uid in excluded:
            continue
        dt = parse_dt(row.get(time_column))
        if dt and (uid not in latest or dt > latest[uid]):
            latest[uid] = dt
    return latest


def count_since(latest, now, delta):
    cutoff = now - delta
    return sum(1 for dt in latest.values() if dt >= cutoff)


def main():
    now = datetime.now(timezone.utc)

    profiles = supabase.table('user_profiles').select('id').eq('is_test_account', True).execute()
    test_ids = {p['id'] for p in profiles.data}

    reads = fetch_all('read_articles', 'user_id, read_at', 'read_at', now - timedelta(days=7))
    readers = last_seen_by_user(reads, 'read_at', test_ids)

    feeds = fetch_all('feeds', 'user_id, last_fetched_at', 'last_fetched_at', now - timedelta(days=30))
    refreshed = last_seen_by_user(feeds, 'last_fetched_at', test_ids)

    print("=" * 50)
    print("  FeedOwn Active Users")
    print(f"  {now.strftime('%Y-%m-%d %H:%M')} UTC  (test accounts excluded: {len(test_ids)})")
    print("=" * 50)
    print()
    print(f"  {'':<26} {'24h':>6} {'7d':>6} {'30d':>6}")
    print(f"  {'Readers (read_articles)':<26} "
          f"{count_since(readers, now, timedelta(days=1)):>6} "
          f"{count_since(readers, now, timedelta(days=7)):>6} "
          f"{'-':>6}")
    print(f"  {'Refreshed (feeds)':<26} "
          f"{count_since(refreshed, now, timedelta(days=1)):>6} "
          f"{count_since(refreshed, now, timedelta(days=7)):>6} "
          f"{count_since(refreshed, now, timedelta(days=30)):>6}")
    print()
    print("  Readers: marked an article as read. Only ~7 days are kept")
    print("           (read_articles is pruned with expired articles).")
    print("  Refreshed: feeds were fetched, including background refresh,")
    print("           so this is closer to 'still installed' than 'opened'.")
    print()


if __name__ == '__main__':
    main()
