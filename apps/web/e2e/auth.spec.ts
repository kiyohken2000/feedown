import { test, expect } from '@playwright/test';

test.describe('Authentication', () => {
  test('should display login page', async ({ page }) => {
    await page.goto('/');

    // Check login page elements
    await expect(page.getByRole('heading', { name: /feedown/i })).toBeVisible();
    await expect(page.getByPlaceholder(/email/i)).toBeVisible();
    await expect(page.getByPlaceholder(/password/i)).toBeVisible();
    await expect(page.getByRole('button', { name: /sign in/i })).toBeVisible();
  });

  test('should show error for invalid credentials', async ({ page }) => {
    await page.goto('/');

    await page.getByPlaceholder(/email/i).fill('invalid@test.com');
    await page.getByPlaceholder(/password/i).fill('wrongpassword');
    await page.getByRole('button', { name: /sign in/i }).click();

    // Wait for error message
    await expect(page.getByText(/invalid|error|failed/i)).toBeVisible({ timeout: 10000 });
  });

  test('should navigate to signup page', async ({ page }) => {
    await page.goto('/');

    // Click on sign up link
    await page.getByRole('link', { name: /sign up|create account|register/i }).click();

    // Check signup page elements
    await expect(page.getByRole('button', { name: /sign up|create|register/i })).toBeVisible();
  });

  test('should show password validation error for short password', async ({ page }) => {
    await page.goto('/');

    // Navigate to signup
    await page.getByRole('link', { name: /sign up|create account|register/i }).click();

    // Try to register with short password
    await page.getByPlaceholder(/email/i).fill('newuser@test.com');
    await page.getByPlaceholder(/password/i).fill('123');
    await page.getByRole('button', { name: /sign up|create|register/i }).click();

    // Should show validation error
    await expect(page.getByText(/6 characters|too short|password/i)).toBeVisible({ timeout: 10000 });
  });
});

test.describe('Authenticated User Flow', () => {
  // Use a test account for authenticated tests
  const testEmail = `e2e-test-${Date.now()}@test.com`;
  const testPassword = '111111';

  test('should register new account and redirect to dashboard', async ({ page }) => {
    await page.goto('/');

    // Navigate to signup
    await page.getByRole('link', { name: /sign up|create account|register/i }).click();

    // Fill registration form
    await page.getByPlaceholder(/email/i).fill(testEmail);
    await page.getByPlaceholder(/password/i).fill(testPassword);
    await page.getByRole('button', { name: /sign up|create|register/i }).click();

    // Should redirect to dashboard
    await expect(page).toHaveURL(/dashboard/, { timeout: 15000 });
  });

  test('should login with existing account', async ({ page }) => {
    // First register the account
    await page.goto('/');
    await page.getByRole('link', { name: /sign up|create account|register/i }).click();
    await page.getByPlaceholder(/email/i).fill(testEmail + '2');
    await page.getByPlaceholder(/password/i).fill(testPassword);
    await page.getByRole('button', { name: /sign up|create|register/i }).click();
    await expect(page).toHaveURL(/dashboard/, { timeout: 15000 });

    // Logout
    await page.goto('/settings');
    await page.getByRole('button', { name: /sign out|logout/i }).click();

    // Login again
    await page.goto('/');
    await page.getByPlaceholder(/email/i).fill(testEmail + '2');
    await page.getByPlaceholder(/password/i).fill(testPassword);
    await page.getByRole('button', { name: /sign in/i }).click();

    // Should redirect to dashboard
    await expect(page).toHaveURL(/dashboard/, { timeout: 15000 });
  });
});
