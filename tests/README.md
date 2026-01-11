# API E2E Test Script

This directory contains a Python script for running end-to-end tests against the deployed Cloudflare Pages Functions API.

## `api_test.py`

This script automates the testing of the main API endpoints.

### Prerequisites

- Python 3
- The `requests` library. Install it using pip:
  ```shell
  pip install requests
  ```

### Usage

1.  **Update the `BASE_URL`**: Before running, open `api_test.py` and ensure the `BASE_URL` constant is set to the correct deployment URL of the Cloudflare Pages project.

    ```python
    # --- Configuration ---
    BASE_URL = "https://your-deployment-url.pages.dev"
    ```

2.  **Run the script**: Execute the script from the project's root directory:

    ```shell
    python tests/api_test.py
    ```

### Test Flow

The script performs the following sequence of tests:

1.  **Register New User**: Creates a new user with a unique, randomly generated email address.
2.  **Login**: Logs in with the newly created user to obtain an authentication token.
3.  **Add Feed**: Adds a test RSS feed (`https://www.theverge.com/rss/index.xml`).
4.  **Get Feeds**: Verifies that the new feed is present in the user's feed list.
5.  **Refresh Feeds**: Calls the refresh endpoint.
6.  **Get Articles**: Calls the articles endpoint.
7.  **Cleanup**: Deletes the test feed to ensure a clean state for subsequent runs.
