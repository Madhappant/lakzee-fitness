import { expect, test } from '@playwright/test';
import {
  attachBrowserErrorCollector,
  loginAsAdmin,
  navigateToMembers,
  readTableMemberIds,
  resetE2EBackend,
} from './support/helpers';

test.describe('Members Page Sorting, Sequential IDs, Filtering & CRUD Flows', () => {
  test.beforeEach(async ({ request }) => {
    await resetE2EBackend(request);
  });

  test('renders default asc (001->011), switches desc & latest, and places newly added member at bottom', async ({ page }) => {
    const { consoleErrors, pageErrors } = attachBrowserErrorCollector(page);

    await loginAsAdmin(page);
    await navigateToMembers(page);

    // Wait for seeded sequential rows (001, 002, 010, 011)
    await expect(page.getByText('Aarav One')).toBeVisible();
    await expect.poll(() => readTableMemberIds(page)).toEqual(['001', '002', '010', '011']);

    const sortDropdown = page.getByLabel('Sort members list');
    await expect(sortDropdown).toHaveValue('asc');

    // Descending (Last -> 001)
    await sortDropdown.selectOption('desc');
    await expect.poll(() => readTableMemberIds(page)).toEqual(['011', '010', '002', '001']);

    // Recently Added / Latest (011 -> 010 -> 002 -> 001 by seeded timestamps)
    await sortDropdown.selectOption('latest');
    await expect.poll(() => readTableMemberIds(page)).toEqual(['011', '010', '002', '001']);

    // Return to default Ascending before adding a new member
    await sortDropdown.selectOption('asc');
    await expect.poll(() => readTableMemberIds(page)).toEqual(['001', '002', '010', '011']);

    // Add a new member and confirm sequential ID 012 lands at the bottom of default asc list
    await page.getByRole('link', { name: 'Add New Member' }).click();
    await page.waitForURL('**/admin/members/new');

    await page.locator('input[name="firstName"]').fill('Priya');
    await page.locator('input[name="lastName"]').fill('Twelve');
    await page.locator('input[name="email"]').fill('priya.012@lakzee.test');
    await page.locator('input[name="password"]').fill('StrongPass!2026');
    await page.getByRole('button', { name: /Save Member/i }).click();

    await page.waitForURL('**/admin/members');
    await expect(page.getByText('Priya Twelve')).toBeVisible();
    await expect.poll(() => readTableMemberIds(page)).toEqual(['001', '002', '010', '011', '012']);

    expect(consoleErrors).toEqual([]);
    expect(pageErrors).toEqual([]);
  });

  test('supports search, status filter pills, editing a member, and deleting a member', async ({ page }) => {
    const { consoleErrors, pageErrors } = attachBrowserErrorCollector(page);

    await loginAsAdmin(page);
    await navigateToMembers(page);
    await expect(page.getByText('Aarav One')).toBeVisible();

    // Search by Member No. / Name
    const searchInput = page.getByLabel('Search members by name, email, or Member No.');
    await searchInput.fill('Meera');
    await expect.poll(() => readTableMemberIds(page)).toEqual(['002']);
    await page.getByRole('button', { name: 'Clear' }).click();
    await expect.poll(() => readTableMemberIds(page)).toEqual(['001', '002', '010', '011']);

    // Filter pills: Active (001, 002) & Inactive (010, 011)
    await page.getByRole('button', { name: 'Active', exact: true }).click();
    await expect.poll(() => readTableMemberIds(page)).toEqual(['001', '002']);

    await page.getByRole('button', { name: 'Inactive', exact: true }).click();
    await expect.poll(() => readTableMemberIds(page)).toEqual(['010', '011']);

    await page.getByRole('button', { name: 'All Status', exact: true }).click();
    await expect.poll(() => readTableMemberIds(page)).toEqual(['001', '002', '010', '011']);

    // Edit member profile via dedicated edit route
    await page.getByRole('link', { name: 'Edit profile for Aarav' }).click();
    await page.waitForURL('**/admin/members/*/edit');
    const firstNameInput = page.locator('input[name="firstName"]');
    await expect(firstNameInput).toHaveValue('Aarav');
    await firstNameInput.fill('AaravUpdated');
    await page.getByRole('button', { name: /Update Member/i }).click();

    await page.waitForURL('**/admin/members');
    await expect(page.getByText('AaravUpdated One')).toBeVisible();

    // Delete member Kavin (010) and confirm removal
    page.once('dialog', (dialog) => dialog.accept());
    await page.getByRole('button', { name: 'Delete member Kavin' }).click();
    await expect(page.getByText('Kavin Ten')).toHaveCount(0);
    await expect.poll(() => readTableMemberIds(page)).toEqual(['001', '002', '011']);

    expect(consoleErrors).toEqual([]);
    expect(pageErrors).toEqual([]);
  });
});
