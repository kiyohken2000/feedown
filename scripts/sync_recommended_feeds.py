#!/usr/bin/env python3
"""
Recommended Feeds Sync Script

This script syncs the recommended feeds list to the Supabase database.
All feeds defined in RECOMMENDED_FEEDS will be upserted to the database.

Usage:
  1. Install dependencies: pip install supabase python-dotenv
  2. Set environment variables (or use .env file):
     - SUPABASE_URL
     - SUPABASE_SERVICE_ROLE_KEY
  3. Run: python scripts/sync_recommended_feeds.py

The script uses the service role key to bypass RLS for write operations.
"""

import os
import sys
from dotenv import load_dotenv
from supabase import create_client, Client

# Load environment variables from .env.shared
env_path = os.path.join(os.path.dirname(__file__), '..', '.env.shared')
load_dotenv(env_path)

# Also try loading from parent directory .env if SUPABASE vars not found
if not os.getenv('SUPABASE_URL'):
    env_path_parent = os.path.join(os.path.dirname(__file__), '..', '.env')
    load_dotenv(env_path_parent)

# =============================================================================
# RECOMMENDED FEEDS LIST
# Edit this list to add/remove/update recommended feeds
# =============================================================================
RECOMMENDED_FEEDS = [
    { "name": "AFP", "url": "http://feeds.afpbb.com/rss/afpbb/afpbbnews" },
    { "name": "BBC", "url": "http://feeds.bbci.co.uk/japanese/rss.xml" },
    { "name": "CNN", "url": "http://feeds.cnn.co.jp/rss/cnn/cnn.rdf" },
    { "name": "Rocket News 24", "url": "http://feeds.rocketnews24.com/rocketnews24" },
    { "name": "Weekly ASCII Plus", "url": "http://weekly.ascii.jp/cate/1/rss.xml" },
    { "name": "National Geographic", "url": "http://nationalgeographic.jp/nng/rss/index.rdf" },
    { "name": "Lifehacker", "url": "http://www.lifehacker.jp/index.xml" },
    { "name": "WIRED.jp", "url": "http://wired.jp/rssfeeder/" },
    { "name": "GIGAZINE", "url": "https://gigazine.net/news/rss_2.0/" },
    { "name": "Gizmodo", "url": "http://feeds.gizmodo.jp/rss/gizmodo/index.xml" },
    { "name": "CNET Japan", "url": "http://feed.japan.cnet.com/rss/index.rdf" },
    { "name": "AAPL Ch.", "url": "http://applech2.com/index.rdf" },
    { "name": "Kitamori Kawaraban", "url": "https://northwood.blog.fc2.com/?xml" },
    { "name": "EE Times Japan", "url": "https://rss.itmedia.co.jp/rss/2.0/eetimes.xml" },
    { "name": "PC Watch", "url": "https://pc.watch.impress.co.jp/data/rss/1.0/pcw/feed.rdf" },
    { "name": "ITmedia PC USER", "url": "https://rss.itmedia.co.jp/rss/2.0/pcupdate.xml" },
    { "name": "朝日新聞速報", "url": "https://www.asahi.com/rss/asahi/newsheadlines.rdf" },
    { "name": "The Verge", "url": "https://www.theverge.com/rss/index.xml" },
]
# =============================================================================


def get_supabase_client() -> Client:
    """Create Supabase client with service role key (bypasses RLS)"""
    url = os.getenv('SUPABASE_URL') or os.getenv('VITE_SUPABASE_URL')
    key = os.getenv('SUPABASE_SERVICE_ROLE_KEY')

    if not url:
        print("Error: SUPABASE_URL or VITE_SUPABASE_URL not found in environment")
        print("Please set the environment variable or create a .env.shared file")
        sys.exit(1)

    if not key:
        print("Error: SUPABASE_SERVICE_ROLE_KEY not found in environment")
        print("This script requires the service role key to write to the database")
        print("You can find it in your Supabase dashboard under Settings > API")
        sys.exit(1)

    return create_client(url, key)


def sync_recommended_feeds(supabase: Client):
    """Sync recommended feeds to database using upsert"""
    print(f"Syncing {len(RECOMMENDED_FEEDS)} recommended feeds...")

    # Prepare data with sort_order
    feeds_data = []
    for idx, feed in enumerate(RECOMMENDED_FEEDS):
        feeds_data.append({
            "name": feed["name"],
            "url": feed["url"],
            "sort_order": idx,
            "is_active": True,
        })

    # Upsert feeds (insert or update based on URL)
    result = supabase.table("recommended_feeds").upsert(
        feeds_data,
        on_conflict="url"  # Use URL as the unique constraint
    ).execute()

    print(f"Successfully synced {len(result.data)} feeds")

    # List current feeds in database
    print("\nCurrent recommended feeds in database:")
    print("-" * 60)

    all_feeds = supabase.table("recommended_feeds") \
        .select("*") \
        .order("sort_order") \
        .execute()

    for feed in all_feeds.data:
        status = "active" if feed["is_active"] else "inactive"
        print(f"  [{feed['sort_order']:2d}] {feed['name']:<25} ({status})")

    print("-" * 60)
    print(f"Total: {len(all_feeds.data)} feeds in database")


def deactivate_missing_feeds(supabase: Client):
    """Mark feeds that are no longer in RECOMMENDED_FEEDS as inactive"""
    current_urls = {feed["url"] for feed in RECOMMENDED_FEEDS}

    # Get all feeds from database
    all_feeds = supabase.table("recommended_feeds").select("*").execute()

    # Find feeds to deactivate
    to_deactivate = [
        feed["id"] for feed in all_feeds.data
        if feed["url"] not in current_urls and feed["is_active"]
    ]

    if to_deactivate:
        print(f"\nDeactivating {len(to_deactivate)} feeds not in current list...")
        supabase.table("recommended_feeds") \
            .update({"is_active": False}) \
            .in_("id", to_deactivate) \
            .execute()
        print("Done.")
    else:
        print("\nNo feeds to deactivate.")


def main():
    print("=" * 60)
    print("FeedOwn - Recommended Feeds Sync")
    print("=" * 60)

    # Connect to Supabase
    print("\nConnecting to Supabase...")
    supabase = get_supabase_client()
    print("Connected!")

    # Sync feeds
    sync_recommended_feeds(supabase)

    # Optionally deactivate missing feeds
    deactivate_missing_feeds(supabase)

    print("\nSync complete!")


if __name__ == "__main__":
    main()
