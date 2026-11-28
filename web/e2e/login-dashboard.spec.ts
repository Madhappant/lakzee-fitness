import { expect, test } from '@playwright/test';
import {
  attachBrowserErrorCollector,
  E2E_ADMIN_EMAIL,
  E2E_ADMIN_PASS,
  resetE2EBackend,
} from './support/helpers';

test.describe('Authentication & Admin Dashboard E2E Flow', () => {
  test.beforeEach(async ({ request }) => {
    await resetE2EBackend(request);
  });

  test('redirects unauthenticated users from protected routes to /login', async ({ page }) => {
    await page.goto('/admin/dashboard');
    await page.waitForURL('**/login');
    await expect(page.getByRole('heading', { name: 'Sign in' })).toBeVisible();

    await page.goto('/admin/members');
    await page.waitForURL('**/login');
  });

  test('loads /login with zero console errors, enforces validation & rejects bad password cleanly', async ({ page }) => {
    const { consoleErrors, pageErrors } = attachBrowserErrorCollector(page, {
      ignoreFailedStatuses: [401],
    });

    await page.goto('/login');
    await expect(page.getByRole('heading', { name: 'Sign in' })).toBeVisible();

    // Native HTML5 required validation blocks empty submission without navigation
    await page.getByRole('button', { name: /Enter Studio/i }).click();
    expect(page.url()).toContain('/login');

    // Invalid password triggers 401 and displays toast notification without navigation
    await page.locator('#login-email').fill(E2E_ADMIN_EMAIL);
    await page.locator('#login-password').fill('WrongPassword123!');
    await page.getByRole('button', { name: /Enter Studio/i }).click();

    await expect(page.getByText(/Invalid credentials/i)).toBeVisible();
    expect(page.url()).toContain('/login');
    expect(consoleErrors).toEqual([]);
    expect(pageErrors).toEqual([]);
  });

  test('signs in as Admin and renders KPI metrics, revenue chart & navigation across viewports', async ({ page }) => {
    const { consoleErrors, pageErrors } = attachBrowserErrorCollector(page);

    await page.goto('/login');
    await page.locator('#login-email').fill(E2E_ADMIN_EMAIL);
    await page.locator('#login-password').fill(E2E_ADMIN_PASS);
    await page.getByRole('button', { name: /Enter Studio/i }).click();

    await page.waitForURL('**/admin/dashboard');
    await expect(page.getByRole('heading', { name: 'Admin Dashboard' })).toBeVisible();

    // Verify key KPI metrics and 14-day revenue chart heading render cleanly
    await expect(page.getByText('Monthly Revenue')).toBeVisible();
    await expect(page.getByText('Total Active Members')).toBeVisible();
    await expect(page.getByText('₹7,000').first()).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Revenue Last 14 Days' })).toBeVisible();
    await expect(page.getByRole('heading', { name: /Studio Telemetry/i })).toBeVisible();
    await expect(page.getByRole('link', { name: 'New Member' })).toBeVisible();

    // Responsive navigation works on both desktop sidebar and mobile menu drawer
    const mobileMenuBtn = page.getByRole('button', { name: 'Open mobile navigation menu' });
    if (await mobileMenuBtn.isVisible()) {
      await mobileMenuBtn.click();
    }
    const nav = page.getByRole('complementary', { name: 'Admin Navigation' });
    await expect(nav.getByRole('link', { name: 'Members', exact: true })).toBeVisible();
    await expect(nav.getByRole('link', { name: 'Attendance', exact: true })).toBeVisible();

    expect(consoleErrors).toEqual([]);
    expect(pageErrors).toEqual([]);
  });
});
