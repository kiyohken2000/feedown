#!/usr/bin/env python3
"""
Recommended Feeds Sync Script

This script syncs the recommended feeds list to the Supabase database.
All feeds defined in RECOMMENDED_FEEDS will be upserted to the database.

Usage:
  1. Install dependencies: pip install supabase python-dotenv requests
  2. Set environment variables (or use .env file):
     - SUPABASE_URL
     - SUPABASE_SERVICE_ROLE_KEY
  3. Run: python scripts/sync_recommended_feeds.py

Commands:
  python scripts/sync_recommended_feeds.py           # Sync feeds to database
  python scripts/sync_recommended_feeds.py --check   # Validate all feeds
  python scripts/sync_recommended_feeds.py --test URL # Test a single feed URL

The script uses the service role key to bypass RLS for write operations.
"""

import os
import sys
import argparse
import xml.etree.ElementTree as ET
from dotenv import load_dotenv
from supabase import create_client, Client

# Fix Windows console encoding
if sys.platform == 'win32':
    sys.stdout.reconfigure(encoding='utf-8', errors='replace')
    sys.stderr.reconfigure(encoding='utf-8', errors='replace')

try:
    import requests
except ImportError:
    print("Error: requests library not installed")
    print("Run: pip install requests")
    sys.exit(1)

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
    { "name": "National Geographic", "url": "http://nationalgeographic.jp/nng/rss/index.rdf" },
    { "name": "朝日新聞速報", "url": "https://www.asahi.com/rss/asahi/newsheadlines.rdf" },
    { "name": "NHKニュース", "url": "https://www3.nhk.or.jp/rss/news/cat0.xml" },
    { "name": "GIGAZINE", "url": "https://gigazine.net/news/rss_2.0/" },
    { "name": "Rocket News 24", "url": "http://feeds.rocketnews24.com/rocketnews24" },
    { "name": "Weekly ASCII Plus", "url": "http://weekly.ascii.jp/cate/1/rss.xml" },
    { "name": "Gizmodo", "url": "http://feeds.gizmodo.jp/rss/gizmodo/index.xml" },
    { "name": "Lifehacker", "url": "http://www.lifehacker.jp/index.xml" },
    { "name": "WIRED.jp", "url": "http://wired.jp/rssfeeder/" },
    { "name": "CNET Japan", "url": "http://feed.japan.cnet.com/rss/index.rdf" },
    { "name": "The Verge", "url": "https://www.theverge.com/rss/index.xml" },
    { "name": "TechCrunch", "url": "https://techcrunch.com/feed/" },
    { "name": "Ars Technica", "url": "https://feeds.arstechnica.com/arstechnica/index" },
    { "name": "Hacker News", "url": "https://news.ycombinator.com/rss" },
    { "name": "PC Watch", "url": "https://pc.watch.impress.co.jp/data/rss/1.0/pcw/feed.rdf" },
    { "name": "ケータイ Watch", "url": "https://k-tai.watch.impress.co.jp/data/rss/1.0/ktw/feed.rdf" },
    { "name": "INTERNET Watch", "url": "https://internet.watch.impress.co.jp/data/rss/1.0/iw/feed.rdf" },
    { "name": "AV Watch", "url": "https://av.watch.impress.co.jp/data/rss/1.0/avw/feed.rdf" },
    { "name": "GAME Watch", "url": "https://game.watch.impress.co.jp/data/rss/1.0/gmw/feed.rdf" },
    { "name": "ITmedia PC USER", "url": "https://rss.itmedia.co.jp/rss/2.0/pcupdate.xml" },
    { "name": "ITmedia Mobile", "url": "https://rss.itmedia.co.jp/rss/2.0/mobile.xml" },
    { "name": "EE Times Japan", "url": "https://rss.itmedia.co.jp/rss/2.0/eetimes.xml" },
    { "name": "4Gamer.net − HARDWARE", "url": "http://www.4gamer.net/rss/hardware/hw_news.xml" },
    { "name": "マイナビニュース パソコン", "url": "http://news.mynavi.jp/rss/digital/pc" },
    { "name": "AAPL Ch.", "url": "http://applech2.com/index.rdf" },
    { "name": "北森瓦版", "url": "https://northwood.blog.fc2.com/?xml" },
    { "name": "iPhone Mania", "url": "https://iphone-mania.jp/feed/" },
    { "name": "すまほん!!", "url": "https://smhn.info/feed" },
    { "name": "HotHardware.com", "url": "https://hothardware.com/rss/news.aspx" },
    { "name": "guru3d", "url": "https://www.guru3d.com/rss.xml" },
    { "name": "OC3D", "url": "https://overclock3d.net/?feed=rss" },
    { "name": "VideoCardz.com", "url": "https://videocardz.com/rss-feed" },
    { "name": "Tom's Hardware", "url": "https://www.tomshardware.com/feeds.xml" },
    { "name": "TechPowerUp News", "url": "https://www.techpowerup.com/rss/news" },
    { "name": "TechPowerUp Reviews", "url": "https://www.techpowerup.com/rss/reviews" },
    { "name": "HEXUS.net", "url": "https://www.hexus.net/rss/" },
    { "name": "Wccftech", "url": "https://wccftech.com/feed/" },
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


def validate_feed(url: str) -> dict:
    """
    Validate a single RSS feed URL.
    Returns dict with validation results.
    """
    result = {
        "url": url,
        "valid": False,
        "format": None,
        "title": None,
        "item_count": 0,
        "error": None,
    }

    try:
        # Fetch the feed
        headers = {"User-Agent": "FeedOwn/1.0 (RSS Reader)"}
        response = requests.get(url, headers=headers, timeout=10)
        response.raise_for_status()

        content = response.text

        # Try to parse as XML
        try:
            root = ET.fromstring(content)
        except ET.ParseError as e:
            result["error"] = f"XML parse error: {e}"
            return result

        # Detect feed format and extract info
        root_tag = root.tag.lower()

        # Remove namespace for easier parsing
        def strip_ns(tag):
            return tag.split('}')[-1] if '}' in tag else tag

        # Atom feed
        if 'feed' in root_tag:
            result["format"] = "Atom"
            title_el = root.find('.//{http://www.w3.org/2005/Atom}title')
            if title_el is None:
                title_el = root.find('.//title')
            result["title"] = title_el.text if title_el is not None else "No title"
            entries = root.findall('.//{http://www.w3.org/2005/Atom}entry')
            if not entries:
                entries = root.findall('.//entry')
            result["item_count"] = len(entries)
            result["valid"] = True

        # RDF feed (RSS 1.0)
        elif 'rdf' in root_tag.lower():
            result["format"] = "RDF (RSS 1.0)"
            # RDF namespace
            ns = {
                'rdf': 'http://www.w3.org/1999/02/22-rdf-syntax-ns#',
                'rss': 'http://purl.org/rss/1.0/',
                'dc': 'http://purl.org/dc/elements/1.1/'
            }
            channel = root.find('.//channel') or root.find('.//{http://purl.org/rss/1.0/}channel')
            if channel is not None:
                title_el = channel.find('title') or channel.find('{http://purl.org/rss/1.0/}title')
                result["title"] = title_el.text if title_el is not None else "No title"
            items = root.findall('.//{http://purl.org/rss/1.0/}item')
            if not items:
                items = root.findall('.//item')
            result["item_count"] = len(items)
            result["valid"] = True

        # RSS 2.0
        elif 'rss' in root_tag or root.find('.//channel') is not None:
            result["format"] = "RSS 2.0"
            channel = root.find('.//channel')
            if channel is not None:
                title_el = channel.find('title')
                result["title"] = title_el.text if title_el is not None else "No title"
                items = channel.findall('item')
                result["item_count"] = len(items)
            result["valid"] = True

        else:
            result["error"] = f"Unknown feed format: {root.tag}"

    except requests.exceptions.Timeout:
        result["error"] = "Timeout (>10s)"
    except requests.exceptions.HTTPError as e:
        result["error"] = f"HTTP error: {e.response.status_code}"
    except requests.exceptions.RequestException as e:
        result["error"] = f"Request error: {e}"
    except Exception as e:
        result["error"] = f"Unexpected error: {e}"

    return result


def check_all_feeds():
    """Validate all feeds in RECOMMENDED_FEEDS list"""
    print("=" * 70)
    print("FeedOwn - Feed Validation")
    print("=" * 70)
    print(f"\nChecking {len(RECOMMENDED_FEEDS)} feeds...\n")

    valid_count = 0
    invalid_count = 0

    for feed in RECOMMENDED_FEEDS:
        name = feed["name"]
        url = feed["url"]

        print(f"Checking: {name}...")
        result = validate_feed(url)

        if result["valid"]:
            valid_count += 1
            print(f"  OK: {result['format']} | {result['item_count']} items | \"{result['title']}\"")
        else:
            invalid_count += 1
            print(f"  NG: {result['error']}")
        print()

    print("=" * 70)
    print(f"Results: {valid_count} valid, {invalid_count} invalid")
    print("=" * 70)

    return invalid_count == 0


def test_single_feed(url: str):
    """Test a single feed URL"""
    print("=" * 70)
    print("FeedOwn - Single Feed Test")
    print("=" * 70)
    print(f"\nURL: {url}\n")

    result = validate_feed(url)

    if result["valid"]:
        print(f"Status:  VALID")
        print(f"Format:  {result['format']}")
        print(f"Title:   {result['title']}")
        print(f"Items:   {result['item_count']}")
    else:
        print(f"Status:  INVALID")
        print(f"Error:   {result['error']}")

    print("=" * 70)

    return result["valid"]


def main():
    parser = argparse.ArgumentParser(description="FeedOwn Recommended Feeds Manager")
    parser.add_argument("--check", action="store_true", help="Validate all feeds without syncing")
    parser.add_argument("--test", metavar="URL", help="Test a single feed URL")
    args = parser.parse_args()

    # Test single URL
    if args.test:
        success = test_single_feed(args.test)
        sys.exit(0 if success else 1)

    # Check all feeds
    if args.check:
        success = check_all_feeds()
        sys.exit(0 if success else 1)

    # Default: sync to database
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
