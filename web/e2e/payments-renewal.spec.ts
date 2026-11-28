import { expect, test } from '@playwright/test';
import {
  E2E_API_ORIGIN,
  attachBrowserErrorCollector,
  loginAsAdmin,
  navigateToMembers,
  resetE2EBackend,
} from './support/helpers';

test.describe('Razorpay Online Renewals, One-Click Links & PDF Receipts E2E', () => {
  test.beforeEach(async ({ request }) => {
    await resetE2EBackend(request);
  });

  test('copies one-click renewal link, completes Razorpay UPI checkout, downloads PDF receipt, and inspects Admin Payments Transactions', async ({
    page,
    request,
  }) => {
    const { consoleErrors, pageErrors } = attachBrowserErrorCollector(page);

    // Expose genuine test-server HMAC signer so Razorpay checkout callback uses real server verification
    await page.exposeFunction('__lakzeeE2ESignOrder', async (orderId: string) => {
      const res = await request.post(`${E2E_API_ORIGIN}/__test__/sign-payment`, {
        data: { orderId },
      });
      expect(res.ok()).toBeTruthy();
      return res.json();
    });

    await loginAsAdmin(page);
    await navigateToMembers(page);

    // Generate & capture the signed one-click renewal link via the Members row button
    const linkResponsePromise = page.waitForResponse(
      (res) => res.url().includes('/api/payments/renewal-link/') && res.request().method() === 'POST'
    );
    const copyBtn = page.getByLabel('Copy renewal link for Meera');
    await expect(copyBtn).toBeVisible();
    await copyBtn.click();

    const linkRes = await linkResponsePromise;
    expect(linkRes.ok()).toBeTruthy();
    const linkJson = (await linkRes.json()) as { data: { renewalUrl: string; token: string } };
    expect(linkJson.data.token.length).toBeGreaterThan(20);
    await expect(page.getByText(/renewal link/i).first()).toBeVisible();

    // Stub window.Razorpay checkout modal cleanly before navigating to /renew?token=...
    await page.addInitScript(() => {
      (window as unknown as { Razorpay: unknown }).Razorpay = class MockRazorpayCheckout {
        private readonly opts: Record<string, unknown>;
        constructor(opts: Record<string, unknown>) {
          this.opts = opts;
        }
        open() {
          const orderId = String(this.opts.order_id || '');
          const signFn = (window as unknown as { __lakzeeE2ESignOrder: (id: string) => Promise<unknown> })
            .__lakzeeE2ESignOrder;
          void signFn(orderId).then((signed) => {
            const handler = this.opts.handler as ((resp: unknown) => void) | undefined;
            handler?.(signed);
          });
        }
        on() {
          // no-op listener registration
        }
      };
    });

    // Open one-click /renew?token=... route on the frontend origin cleanly
    const parsedUrl = new URL(linkJson.data.renewalUrl);
    await page.goto(`${parsedUrl.pathname}${parsedUrl.search}`);

    await expect(page.getByRole('heading', { name: 'Online Membership Renewal' })).toBeVisible();
    await expect(page.getByText('Meera Two').first()).toBeVisible();
    await expect(page.getByText('Pro Strength').first()).toBeVisible();

    // Pay via UPI / Razorpay CTA
    await page.getByRole('button', { name: /Pay via UPI \/ Razorpay/i }).click();

    await expect(page.getByText('Payment Captured')).toBeVisible();
    await expect(page.getByText(/INV-BR001-/i).first()).toBeVisible();

    // Download branded PDF receipt directly from checkout confirmation
    const [download] = await Promise.all([
      page.waitForEvent('download'),
      page.getByRole('button', { name: /Download Receipt \(PDF\)/i }).click(),
    ]);
    expect(download.suggestedFilename()).toMatch(/^Receipt-INV-BR001-.*\.pdf$/i);

    // Verify transaction appears inside Admin -> Payments -> Razorpay & Online Transactions
    await page.goto('/admin/payments');
    await expect(page.getByRole('heading', { name: 'Payments & Subscriptions' })).toBeVisible();
    await page.getByRole('button', { name: /Razorpay & Online Transactions/i }).click();

    await expect(page.getByText('Meera Two').first()).toBeVisible();
    await expect(page.getByText('Captured').first()).toBeVisible();

    const [adminDownload] = await Promise.all([
      page.waitForEvent('download'),
      page.getByRole('button', { name: /Download Receipt/i }).first().click(),
    ]);
    expect(adminDownload.suggestedFilename()).toMatch(/^Receipt-INV-BR001-.*\.pdf$/i);

    expect(consoleErrors).toEqual([]);
    expect(pageErrors).toEqual([]);
  });

  test('allows signed-in Member to access /member/subscriptions, Renew CTA, and online receipt history', async ({
    page,
  }) => {
    const { consoleErrors, pageErrors } = attachBrowserErrorCollector(page);

    await page.goto('/login');
    await page.locator('#login-email').fill('aarav.001@lakzee.test');
    await page.locator('#login-password').fill('TestPass!2026');
    await page.getByRole('button', { name: /Enter Studio/i }).click();

    await page.waitForURL('**/member**');
    await page.goto('/member/subscriptions');

    await expect(page.getByRole('heading', { name: 'My Subscriptions' })).toBeVisible();
    await expect(page.getByRole('link', { name: /Renew \/ Pay via UPI/i })).toBeVisible();
    await expect(page.getByRole('heading', { name: /Tax Receipts \(PDF\)/i })).toBeVisible();

    expect(consoleErrors).toEqual([]);
    expect(pageErrors).toEqual([]);
  });
});
