import { test, expect } from '@playwright/test';

test.describe('Dashboard', () => {
  // Setup: Create a test account and login before each test
  const testEmail = `e2e-dashboard-${Date.now()}@test.com`;
  const testPassword = '111111';

  test.beforeEach(async ({ page }) => {
    // Register and login
    await page.goto('/');
    await page.getByRole('link', { name: /sign up|create account|register/i }).click();
    await page.getByPlaceholder(/email/i).fill(testEmail + Math.random());
    await page.getByPlaceholder(/password/i).fill(testPassword);
    await page.getByRole('button', { name: /sign up|create|register/i }).click();
    await expect(page).toHaveURL(/dashboard/, { timeout: 15000 });
  });

  test('should display empty state when no feeds', async ({ page }) => {
    // Dashboard should show empty state
    await expect(page.getByText(/no articles|add.*feed|get started/i)).toBeVisible({ timeout: 10000 });
  });

  test('should have navigation elements', async ({ page }) => {
    // Check sidebar/navigation elements
    await expect(page.getByRole('link', { name: /feeds/i })).toBeVisible();
    await expect(page.getByRole('link', { name: /favorites/i })).toBeVisible();
    await expect(page.getByRole('link', { name: /settings/i })).toBeVisible();
  });

  test('should navigate to feeds page', async ({ page }) => {
    await page.getByRole('link', { name: /feeds/i }).click();
    await expect(page).toHaveURL(/feeds/);
  });

  test('should navigate to favorites page', async ({ page }) => {
    await page.getByRole('link', { name: /favorites/i }).click();
    await expect(page).toHaveURL(/favorites/);
  });

  test('should navigate to settings page', async ({ page }) => {
    await page.getByRole('link', { name: /settings/i }).click();
    await expect(page).toHaveURL(/settings/);
  });
});

test.describe('Feeds Management', () => {
  const testEmail = `e2e-feeds-${Date.now()}@test.com`;
  const testPassword = '111111';

  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.getByRole('link', { name: /sign up|create account|register/i }).click();
    await page.getByPlaceholder(/email/i).fill(testEmail + Math.random());
    await page.getByPlaceholder(/password/i).fill(testPassword);
    await page.getByRole('button', { name: /sign up|create|register/i }).click();
    await expect(page).toHaveURL(/dashboard/, { timeout: 15000 });
  });

  test('should display feeds page with add feed form', async ({ page }) => {
    await page.goto('/feeds');

    // Check for add feed input
    await expect(page.getByPlaceholder(/url|feed/i)).toBeVisible();
    await expect(page.getByRole('button', { name: /add/i })).toBeVisible();
  });

  test('should show recommended feeds', async ({ page }) => {
    await page.goto('/feeds');

    // Wait for recommended feeds to load
    await expect(page.getByText(/recommended|suggested/i)).toBeVisible({ timeout: 10000 });
  });

  test('should add a feed', async ({ page }) => {
    await page.goto('/feeds');

    // Add a known RSS feed
    const feedUrl = 'https://hnrss.org/frontpage';
    await page.getByPlaceholder(/url|feed/i).fill(feedUrl);
    await page.getByRole('button', { name: /add/i }).click();

    // Wait for feed to be added
    await expect(page.getByText(/hacker news|hnrss/i)).toBeVisible({ timeout: 15000 });
  });

  test('should show error for invalid feed URL', async ({ page }) => {
    await page.goto('/feeds');

    // Try to add invalid URL
    await page.getByPlaceholder(/url|feed/i).fill('not-a-valid-url');
    await page.getByRole('button', { name: /add/i }).click();

    // Should show error
    await expect(page.getByText(/invalid|error|failed/i)).toBeVisible({ timeout: 10000 });
  });
});

test.describe('Settings', () => {
  const testEmail = `e2e-settings-${Date.now()}@test.com`;
  const testPassword = '111111';

  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.getByRole('link', { name: /sign up|create account|register/i }).click();
    await page.getByPlaceholder(/email/i).fill(testEmail + Math.random());
    await page.getByPlaceholder(/password/i).fill(testPassword);
    await page.getByRole('button', { name: /sign up|create|register/i }).click();
    await expect(page).toHaveURL(/dashboard/, { timeout: 15000 });
  });

  test('should display settings page', async ({ page }) => {
    await page.goto('/settings');

    // Check for settings elements
    await expect(page.getByText(/settings/i)).toBeVisible();
    await expect(page.getByRole('button', { name: /sign out|logout/i })).toBeVisible();
  });

  test('should have dark mode toggle', async ({ page }) => {
    await page.goto('/settings');

    // Check for dark mode option
    await expect(page.getByText(/dark mode|theme/i)).toBeVisible();
  });

  test('should sign out successfully', async ({ page }) => {
    await page.goto('/settings');

    await page.getByRole('button', { name: /sign out|logout/i }).click();

    // Should redirect to login page
    await expect(page).toHaveURL(/^\/$/, { timeout: 10000 });
  });

  test('should have clear data option', async ({ page }) => {
    await page.goto('/settings');

    // Check for clear data button
    await expect(page.getByRole('button', { name: /clear.*data/i })).toBeVisible();
  });

  test('should have delete account option', async ({ page }) => {
    await page.goto('/settings');

    // Check for delete account button
    await expect(page.getByRole('button', { name: /delete.*account/i })).toBeVisible();
  });
});
