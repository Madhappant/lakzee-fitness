import { expect, test } from '@playwright/test';
import {
  attachBrowserErrorCollector,
  E2E_API_ORIGIN,
  loginAsAdmin,
  navigateToMembers,
  resetE2EBackend,
} from './support/helpers';

const MOCK_REPORTS_RESPONSE = {
  success: true,
  data: {
    revenue30d: 84500,
    revenueThisMonth: 52000,
    activeMembers: 42,
    visits30d: 318,
    dailyRevenue: [
      { name: 'Nov 22', fullDate: '22 Nov 2026', revenue: 12000 },
      { name: 'Nov 23', fullDate: '23 Nov 2026', revenue: 25000 },
      { name: 'Nov 24', fullDate: '24 Nov 2026', revenue: 9500 },
      { name: 'Nov 25', fullDate: '25 Nov 2026', revenue: 18500 },
      { name: 'Nov 26', fullDate: '26 Nov 2026', revenue: 19500 },
    ],
    dailyVisits: [
      { name: 'Nov 22', visits: 54 },
      { name: 'Nov 23', visits: 68 },
      { name: 'Nov 24', visits: 61 },
      { name: 'Nov 25', visits: 72 },
      { name: 'Nov 26', visits: 63 },
    ],
    paymentMix: [
      { name: 'UPI', value: 24 },
      { name: 'CASH', value: 12 },
      { name: 'CARD', value: 6 },
    ],
    genderMix: [
      { name: 'Male', value: 28 },
      { name: 'Female', value: 14 },
    ],
    entireDailyRevenue: [
      { name: 'Nov 22', fullDate: '22 Nov 2026', revenue: 12000 },
      { name: 'Nov 23', fullDate: '23 Nov 2026', revenue: 25000 },
    ],
    activeMembersList: [],
    thisMonthPaymentsList: [],
  },
};

test.describe('Apple Liquid Glass UI, Golden Yellow Palette & Chart/Mobile Layout', () => {
  test.beforeEach(async ({ request }) => {
    await resetE2EBackend(request);
  });

  test('applies Apple Liquid Glass & Golden Yellow with zero Volt Lime across login & portal', async ({ page }) => {
    const { consoleErrors, pageErrors } = attachBrowserErrorCollector(page);

    await page.goto('/login');
    await expect(page.getByRole('heading', { name: 'Sign in' })).toBeVisible();

    const loginTokens = await page.evaluate(() => {
      const cta = Array.from(document.querySelectorAll('button')).find((b) =>
        b.textContent?.includes('Enter Studio')
      );
      const glassCard = document.querySelector('.apple-glass-elevated, .apple-glass');
      const rootVars = getComputedStyle(document.documentElement);
      return {
        primaryVar: rootVars.getPropertyValue('--primary').trim().toUpperCase(),
        ctaBg: cta ? getComputedStyle(cta).backgroundColor : '',
        glassBackdrop: glassCard ? getComputedStyle(glassCard).backdropFilter : '',
      };
    });

    expect(loginTokens.primaryVar).toBe('#DBA12C');
    expect(loginTokens.ctaBg).toBe('rgb(219, 161, 44)');
    expect(loginTokens.glassBackdrop).toContain('blur(');
    expect(loginTokens.ctaBg).not.toBe('rgb(212, 255, 0)');

    await loginAsAdmin(page);

    // Check zero horizontal overflow on Admin Dashboard & Members page
    for (const checkRoute of ['/admin/dashboard', '/admin/members', '/admin/payments']) {
      if (checkRoute === '/admin/members') {
        await navigateToMembers(page);
      } else if (checkRoute !== '/admin/dashboard') {
        await page.goto(checkRoute);
      }
      await expect
        .poll(async () =>
          page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1)
        )
        .toBe(true);
    }

    expect(consoleErrors).toEqual([]);
    expect(pageErrors).toEqual([]);
  });

  test('renders Reports donut charts without legend overlap and zero mobile horizontal overflow', async ({ page }) => {
    const { consoleErrors, pageErrors } = attachBrowserErrorCollector(page);

    await page.route(`${E2E_API_ORIGIN}/api/reports*`, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(MOCK_REPORTS_RESPONSE),
      });
    });

    await loginAsAdmin(page);
    await page.goto('/admin/reports');
    await expect(page.getByRole('heading', { name: 'Reports & Analytics' })).toBeVisible();
    await expect(page.getByText('Payment Method Mix (30d)')).toBeVisible();
    await expect(page.getByText('Gender Mix')).toBeVisible();

    // Verify no horizontal overflow on desktop and mobile viewports
    const overflow = await page.evaluate(() => ({
      scrollWidth: document.documentElement.scrollWidth,
      innerWidth: window.innerWidth,
    }));
    expect(overflow.scrollWidth).toBeLessThanOrEqual(overflow.innerWidth + 1);

    // Verify pie SVG and legend labels never collide/overlap
    for (const headingText of ['Payment Method Mix (30d)', 'Gender Mix']) {
      const card = page.locator('div.apple-glass', { hasText: headingText }).first();
      const svg = card.locator('svg.recharts-surface').first();
      const firstLegendRow = card.locator('span.truncate').first();
      await expect(svg).toBeVisible();
      await expect(firstLegendRow).toBeVisible();

      const svgBox = await svg.boundingBox();
      const legendBox = await firstLegendRow.boundingBox();
      expect(svgBox).toBeTruthy();
      expect(legendBox).toBeTruthy();

      if (svgBox && legendBox) {
        const separatedHorizontally =
          svgBox.x + svgBox.width <= legendBox.x + 2 || legendBox.x + legendBox.width <= svgBox.x + 2;
        const separatedVertically =
          svgBox.y + svgBox.height <= legendBox.y + 2 || legendBox.y + legendBox.height <= svgBox.y + 2;
        expect(separatedHorizontally || separatedVertically).toBe(true);
      }
    }

    expect(consoleErrors).toEqual([]);
    expect(pageErrors).toEqual([]);
  });
});
