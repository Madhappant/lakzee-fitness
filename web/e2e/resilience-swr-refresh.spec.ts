import { expect, test } from '@playwright/test';
import {
  attachBrowserErrorCollector,
  E2E_API_ORIGIN,
  loginAsAdmin,
  navigateToMembers,
  readTableMemberIds,
  resetE2EBackend,
} from './support/helpers';

test.describe('Performance & Auth Resilience: SWR Cache Hydration & Silent Token Refresh', () => {
  test.beforeEach(async ({ request }) => {
    await resetE2EBackend(request);
  });

  test('renders hydrated SWR snapshot immediately on reload before delayed API revalidation settles', async ({ page }) => {
    const { consoleErrors, pageErrors } = attachBrowserErrorCollector(page);

    await loginAsAdmin(page);
    await navigateToMembers(page);
    await expect(page.getByText('Aarav One')).toBeVisible();

    // Wait for debounced React Query persistence to flush snapshot into localStorage
    await page.waitForFunction(() => {
      const raw = localStorage.getItem('lakzee_swr_cache_v1');
      return Boolean(raw && raw.includes('Aarav'));
    });

    // Gate network GET /api/members with an explicit promise so we prove UI renders BEFORE network completes
    let releaseNetworkFetch!: () => void;
    const delayedFetchGate = new Promise<void>((resolve) => {
      releaseNetworkFetch = resolve;
    });

    await page.route(`${E2E_API_ORIGIN}/api/members*`, async (route) => {
      await delayedFetchGate;
      await route.continue();
    });

    const revalidationPromise = page.waitForResponse(
      (res) => res.url().includes('/api/members') && res.request().method() === 'GET'
    );

    await page.reload();
    await expect(page.getByRole('heading', { name: 'Members Management' })).toBeVisible();
    // Snapshot from SWR cache renders immediately while network request is still held open
    await expect(page.getByText('Aarav One')).toBeVisible();
    await expect.poll(() => readTableMemberIds(page)).toEqual(['001', '002', '010', '011']);

    // Release delayed network revalidation and wait for 200 before unrouting
    releaseNetworkFetch();
    const revalidationResponse = await revalidationPromise;
    expect(revalidationResponse.status()).toBe(200);
    await page.unroute(`${E2E_API_ORIGIN}/api/members*`);
    await expect(page.getByText('Rohan Eleven')).toBeVisible();

    expect(consoleErrors).toEqual([]);
    expect(pageErrors).toEqual([]);
  });

  test('silently refreshes expired access token via HttpOnly cookie without kicking user to /login', async ({ page }) => {
    const { consoleErrors, pageErrors } = attachBrowserErrorCollector(page, {
      ignoreFailedStatuses: [401],
    });

    await loginAsAdmin(page);
    await navigateToMembers(page);
    await expect(page.getByText('Aarav One')).toBeVisible();

    // Corrupt only the short-lived access token in localStorage; keep HttpOnly refresh cookie intact
    await page.evaluate(() => {
      localStorage.setItem('lakzee_token', 'expired.access.token.value');
      localStorage.removeItem('lakzee_swr_cache_v1');
    });

    const refreshResponsePromise = page.waitForResponse(
      (res) => res.url().includes('/api/auth/refresh') && res.request().method() === 'POST'
    );

    await page.reload();

    const refreshResponse = await refreshResponsePromise;
    expect(refreshResponse.status()).toBe(200);

    // User stays on /admin/members, refreshed token is stored, and roster loads completely
    await expect(page.getByRole('heading', { name: 'Members Management' })).toBeVisible();
    await expect(page.getByText('Aarav One')).toBeVisible();
    expect(page.url()).toContain('/admin/members');

    const updatedToken = await page.evaluate(() => localStorage.getItem('lakzee_token'));
    expect(updatedToken).toBeTruthy();
    expect(updatedToken).not.toBe('expired.access.token.value');

    expect(consoleErrors).toEqual([]);
    expect(pageErrors).toEqual([]);
  });

  test('forwards redacted frontend error & telemetry beacon without crashing session on 500 API error', async ({ page }) => {
    const { pageErrors } = attachBrowserErrorCollector(page);

    await loginAsAdmin(page);
    await navigateToMembers(page);
    await expect(page.getByText('Aarav One')).toBeVisible();

    await page.evaluate(() => {
      localStorage.removeItem('lakzee_swr_cache_v1');
    });

    await page.route(`${E2E_API_ORIGIN}/api/members*`, async (route) => {
      await route.fulfill({
        status: 500,
        contentType: 'application/json',
        body: JSON.stringify({ success: false, status: 'error', message: 'Synthetic 500 failure' }),
      });
    });

    const telemetryBeaconPromise = page.waitForResponse(
      (res) => res.url().includes('/api/telemetry/client') && res.request().method() === 'POST'
    );

    await page.reload();
    await expect(page.getByRole('heading', { name: 'Members Management' })).toBeVisible();

    const telemetryRes = await telemetryBeaconPromise;
    expect(telemetryRes.status()).toBe(202);
    expect(pageErrors).toEqual([]);
  });
});
