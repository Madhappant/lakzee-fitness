import { expect, test } from '@playwright/test';
import {
  attachBrowserErrorCollector,
  loginAsAdmin,
  navigateToMembers,
  resetE2EBackend,
} from './support/helpers';

test.describe('Automated Expiry Reminders & Delivery Logs UI', () => {
  test.beforeEach(async ({ request }) => {
    await resetE2EBackend(request);
  });

  test('triggers manual renewal reminder from Members page, views logs on Reminders page, and configures Settings toggles', async ({ page }) => {
    const { consoleErrors, pageErrors } = attachBrowserErrorCollector(page);

    await loginAsAdmin(page);
    await navigateToMembers(page);

    // Member 002 (Meera Two) is seeded expiring in 3 days -> eligible for manual reminder icon button
    const sendBtn = page.getByLabel('Send reminder to Meera');
    await expect(sendBtn).toBeVisible();
    await sendBtn.click();
    await expect(page.getByText(/Reminder sent to Meera/i)).toBeVisible();

    // Navigate to Reminders Console (opening mobile nav drawer when needed)
    const mobileMenuBtn = page.getByRole('button', { name: 'Open mobile navigation menu' });
    if (await mobileMenuBtn.isVisible()) {
      await mobileMenuBtn.click();
    }
    await page
      .getByRole('complementary', { name: 'Admin Navigation' })
      .getByRole('link', { name: 'Reminders', exact: true })
      .click();

    await page.waitForURL('**/admin/reminders');
    await expect(page.getByRole('heading', { name: 'Expiry Reminders & Delivery Logs' })).toBeVisible();
    await expect(page.getByText('Meera Two').first()).toBeVisible();
    await expect(page.getByText('EMAIL').first()).toBeVisible();

    // Execute Dry-Run Sweep from Admin UI
    await page.getByRole('button', { name: /Dry-Run Sweep/i }).click();
    await expect(page.getByText(/\[Dry-Run\] Sweep done/i)).toBeVisible();

    // Configure reminder toggles & milestones on Settings page
    if (await mobileMenuBtn.isVisible()) {
      await mobileMenuBtn.click();
    }
    await page
      .getByRole('complementary', { name: 'Admin Navigation' })
      .getByRole('link', { name: 'Settings', exact: true })
      .click();
    await page.waitForURL('**/admin/settings');
    await expect(page.getByText('Automated Expiry Reminders')).toBeVisible();

    const whatsappCheckbox = page.getByLabel('Enable WhatsApp expiry reminders');
    await expect(whatsappCheckbox).toBeChecked();
    await whatsappCheckbox.uncheck();
    await page.getByRole('button', { name: /3 Days Left/i }).click();
    await page.getByRole('button', { name: /Save Configuration/i }).click();
    await expect(page.getByText('Settings updated successfully!')).toBeVisible();

    expect(consoleErrors).toEqual([]);
    expect(pageErrors).toEqual([]);
  });
});
