import { expect, test } from '@playwright/test';
import {
  attachBrowserErrorCollector,
  E2E_ADMIN_PASS,
  loginAsAdmin,
  navigateToMembers,
  readTableMemberIds,
  resetE2EBackend,
} from './support/helpers';

test.describe('Multi-Branch Tenancy & SUPER_ADMIN Branch Switcher UI', () => {
  test.beforeEach(async ({ request }) => {
    await resetE2EBackend(request);
  });

  test('hides Branch Switcher from single-branch ADMIN and keeps Branch B roster strictly isolated', async ({ page }) => {
    const { consoleErrors, pageErrors } = attachBrowserErrorCollector(page);

    await loginAsAdmin(page);
    await expect(page.getByLabel('Switch active branch')).toHaveCount(0);

    await navigateToMembers(page);
    await expect.poll(() => readTableMemberIds(page)).toEqual(['001', '002', '010', '011']);
    await expect(page.getByText('Vikram AnnaNagar')).toHaveCount(0);

    expect(consoleErrors).toEqual([]);
    expect(pageErrors).toEqual([]);
  });

  test('renders Branch Switcher for SUPER_ADMIN, switches cleanly between Branch #1 & Branch #2, and creates a new branch', async ({ page }) => {
    const { consoleErrors, pageErrors } = attachBrowserErrorCollector(page);

    await page.goto('/login');
    await page.locator('#login-email').fill('owner@lakzee.fit');
    await page.locator('#login-password').fill(E2E_ADMIN_PASS);
    await page.getByRole('button', { name: /Enter Studio/i }).click();

    await page.waitForURL('**/admin/dashboard');
    await expect(page.getByRole('heading', { name: 'Admin Dashboard' })).toBeVisible();

    const branchSwitcher = page.getByLabel('Switch active branch');
    await expect(branchSwitcher).toBeVisible();
    await expect(branchSwitcher).toHaveValue('all');
    await expect(branchSwitcher.locator('option[value="branch-secondary-002"]')).toBeAttached();

    await navigateToMembers(page);
    // Global view displays members across Branch #1 (4) and Branch #2 (1)
    await expect(page.getByText('Vikram AnnaNagar')).toBeVisible();
    await expect(page.getByText('Aarav One')).toBeVisible();

    // Switch strictly to Branch #2 -> renders only Branch #2 member '001'
    await branchSwitcher.selectOption('branch-secondary-002');
    await expect.poll(() => readTableMemberIds(page)).toEqual(['001']);
    await expect(page.getByText('Vikram AnnaNagar')).toBeVisible();
    await expect(page.getByText('Aarav One')).toHaveCount(0);

    // Switch back to Branch #1 -> renders only Branch #1 sorted roster
    await branchSwitcher.selectOption('branch-primary-001');
    await expect.poll(() => readTableMemberIds(page)).toEqual(['001', '002', '010', '011']);
    await expect(page.getByText('Vikram AnnaNagar')).toHaveCount(0);

    // Provision a brand-new Branch #3 via the quick + modal button in the topbar
    await page.getByLabel('Add new gym branch').click();
    await page.getByPlaceholder('e.g. Anna Nagar Flagship').fill('Velachery Box');
    await page.getByPlaceholder('e.g. Chennai West').fill('Chennai South');
    await page.getByRole('button', { name: 'Create Branch' }).click();
    await expect.poll(() => readTableMemberIds(page)).toEqual([]);
    await expect(page.getByText('No members found')).toBeVisible();

    expect(consoleErrors).toEqual([]);
    expect(pageErrors).toEqual([]);
  });
});
