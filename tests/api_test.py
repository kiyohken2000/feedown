import requests
import uuid

# --- Configuration ---
BASE_URL = "https://39ab0d28.feedown.pages.dev"
# Use a unique email for each run to avoid registration errors
TEST_EMAIL = f"testuser_{uuid.uuid4().hex[:8]}@example.com"
TEST_PASSWORD = "password123"
TEST_FEED_URL = "https://www.theverge.com/rss/index.xml"

def main():
    """Main function to run the API test suite."""
    id_token = None
    feed_id = None
    
    try:
        print("======== API Test Suite for FeedOwn ========")

        # 1. Register New User
        print(f"\n[1/7] Registering new user: {TEST_EMAIL}")
        try:
            response = requests.post(f"{BASE_URL}/api/auth/register", json={
                "email": TEST_EMAIL,
                "password": TEST_PASSWORD
            })
            response.raise_for_status()
            data = response.json()
            id_token = data.get("token")
            if id_token:
                print("-> SUCCESS: Registration successful and token received.")
            else:
                print("-> FAILED: Token not found in registration response.")
                return
        except requests.exceptions.HTTPError as e:
            print(f"-> FAILED: Registration failed. Status: {e.response.status_code}, Response: {e.response.text}")
            # If user already exists, try to log in
            if e.response.status_code == 400:
                pass
            else:
                return

        # 2. Login (if registration failed or to verify)
        if not id_token:
            print(f"\n[2/7] Logging in as user: {TEST_EMAIL}")
            try:
                response = requests.post(f"{BASE_URL}/api/auth/login", json={
                    "email": TEST_EMAIL,
                    "password": TEST_PASSWORD
                })
                response.raise_for_status()
                data = response.json()
                id_token = data.get("token")
                if id_token:
                    print("-> SUCCESS: Login successful and token received.")
                else:
                    print("-> FAILED: Token not found in login response.")
                    return
            except requests.exceptions.RequestException as e:
                print(f"-> FAILED: Login request failed: {e}")
                return
        else:
             print(f"\n[2/7] Skipping Login (already have token).")


        headers = {"Authorization": f"Bearer {id_token}"}

        # 3. Add Feed
        print(f"\n[3/7] Adding a new feed: {TEST_FEED_URL}")
        try:
            response = requests.post(f"{BASE_URL}/api/feeds", headers=headers, json={
                "url": TEST_FEED_URL
            })
            response.raise_for_status()
            data = response.json()
            print(f"DEBUG: Add Feed Response: {data}") # ここを追加
            feed_id = data.get("feed", {}).get("id")
            if feed_id:
                print(f"-> SUCCESS: Feed added successfully. Feed ID: {feed_id}")
            else:
                print("-> FAILED: Feed ID not found in response.")
                print(f"DEBUG: Full response data: {data}") # ここも追加
        except requests.exceptions.RequestException as e:
            print(f"-> FAILED: Add feed request failed: {e}")
            
        # 4. Get Feeds
        print(f"\n[4/7] Getting feeds list")
        try:
            response = requests.get(f"{BASE_URL}/api/feeds", headers=headers)
            response.raise_for_status()
            feeds_response = response.json()
            if any(feed.get("id") == feed_id for feed in feeds_response.get("feeds", [])):
                print("-> SUCCESS: Newly added feed found in the list.")
            else:
                print("-> FAILED: Newly added feed not found.")
        except requests.exceptions.RequestException as e:
            print(f"-> FAILED: Get feeds request failed: {e}")
            
        # 5. Refresh Feeds
        print(f"\n[5/7] Refreshing all feeds")
        try:
            response = requests.post(f"{BASE_URL}/api/refresh", headers=headers)
            response.raise_for_status()
            print(f"-> SUCCESS: Refresh request completed with status {response.status_code}.")
            print("   (Note: Actual parsing is a mock, so this only checks API reachability)")
        except requests.exceptions.RequestException as e:
            print(f"-> FAILED: Refresh feeds request failed: {e}")

        # 6. Get Articles
        print(f"\n[6/7] Getting articles")
        try:
            response = requests.get(f"{BASE_URL}/api/articles", headers=headers)
            response.raise_for_status()
            articles = response.json()
            print(f"-> SUCCESS: Get articles request completed. Found {len(articles)} articles.")
        except requests.exceptions.RequestException as e:
            print(f"-> FAILED: Get articles request failed: {e}")

    finally:
        # 7. Cleanup: Delete Feed
        if id_token and feed_id:
            print(f"\n[7/7] Cleaning up (deleting feed: {feed_id})")
            import time # 追加
            time.sleep(1) # 追加
            try:
                response = requests.delete(f"{BASE_URL}/api/feeds/{feed_id}", headers=headers)
                response.raise_for_status()
                print("-> SUCCESS: Cleanup successful.")
            except requests.exceptions.RequestException as e:
                print(f"-> FAILED: Cleanup request failed: {e}")
        
        print("\n======== Test Suite Finished ========")


if __name__ == "__main__":
    main()
