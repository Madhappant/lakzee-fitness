import { expect, type APIRequestContext, type Page } from '@playwright/test';

export const E2E_API_ORIGIN = 'http://127.0.0.1:5055';
export const E2E_ADMIN_EMAIL = 'admin@lakzee.fit';
export const E2E_ADMIN_PASS = 'TestPass!2026';

export async function resetE2EBackend(request: APIRequestContext): Promise<void> {
  const res = await request.post(`${E2E_API_ORIGIN}/__test__/reset`);
  expect(res.ok()).toBeTruthy();
}

export function attachBrowserErrorCollector(
  page: Page,
  options: { ignoreFailedStatuses?: number[] } = {}
): { consoleErrors: string[]; pageErrors: string[] } {
  const consoleErrors: string[] = [];
  const pageErrors: string[] = [];

  page.on('console', (msg) => {
    if (msg.type() === 'error') {
      const text = msg.text();
      if (
        options.ignoreFailedStatuses?.some((code) =>
          text.includes(`status of ${code}`)
        )
      ) {
        return;
      }
      consoleErrors.push(text);
    }
  });

  page.on('pageerror', (err) => {
    pageErrors.push(err.message);
  });

  return { consoleErrors, pageErrors };
}

export async function loginAsAdmin(page: Page): Promise<void> {
  await page.goto('/login');
  await page.locator('#login-email').fill(E2E_ADMIN_EMAIL);
  await page.locator('#login-password').fill(E2E_ADMIN_PASS);
  await page.getByRole('button', { name: /Enter Studio/i }).click();
  await page.waitForURL('**/admin/dashboard');
  await expect(page.getByRole('heading', { name: 'Admin Dashboard' })).toBeVisible();
}

export async function navigateToMembers(page: Page): Promise<void> {
  const mobileMenuBtn = page.getByRole('button', { name: 'Open mobile navigation menu' });
  if (await mobileMenuBtn.isVisible()) {
    await mobileMenuBtn.click();
  }
  await page
    .getByRole('complementary', { name: 'Admin Navigation' })
    .getByRole('link', { name: 'Members', exact: true })
    .click();
  await page.waitForURL('**/admin/members');
  await expect(page.getByRole('heading', { name: 'Members Management' })).toBeVisible();
}

export async function readTableMemberIds(page: Page): Promise<string[]> {
  return page.locator('tbody tr').evaluateAll((rows) =>
    rows
      .map((row) => row.querySelector('td')?.querySelector('button')?.textContent?.trim() ?? '')
      .filter((text) => text.length > 0)
  );
}
