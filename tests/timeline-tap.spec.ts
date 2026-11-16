import { expect, test } from '@playwright/test';

const EMPTY_STYLE = JSON.stringify({
  version: 8,
  sources: {},
  layers: [{ id: 'bg', type: 'background', paint: { 'background-color': '#e8e8e8' } }],
});

test.beforeEach(async ({ page }) => {
  await page.route(/tiles\.openfreemap\.org/, (r) =>
    r.request().url().includes('/styles/')
      ? r.fulfill({ contentType: 'application/json', body: EMPTY_STYLE })
      : r.abort(),
  );
  await page.route(/router\.project-osrm\.org|photon\.komoot\.io/, (r) => r.abort());
});

test('day runs 5 AM to 5 AM and tapping an item opens its place', async ({ page }) => {
  await page.goto('./?mock=1&reset=1#/plan/2026-11-20');
  const grid = page.locator('.tl-grid');
  await expect(grid.locator('.tl-label').first()).toHaveText('5 AM');
  await expect(grid.locator('.tl-label').last()).toHaveText('4 AM');

  const item = page.getByRole('button', { name: /3 PM to 4 PM$/ });
  await item.click();
  const row = page.locator('#place-mock-cafe');
  await expect(row.locator('.row-button')).toHaveAttribute('aria-expanded', 'true');
  await expect(row).toBeInViewport();
  await expect(page.getByRole('dialog')).toHaveCount(0);

  await item.scrollIntoViewIfNeeded();
  await item.dblclick();
  await expect(page.getByRole('dialog')).toBeVisible();
});

test('an item can run past midnight', async ({ page }) => {
  await page.goto('./?mock=1&reset=1#/plan/2026-11-20');
  await page.getByRole('button', { name: /3 PM to 4 PM$/ }).dblclick();
  const sheet = page.getByRole('dialog');
  await sheet.getByLabel('End').selectOption({ label: '1 AM' });
  await expect(page.getByRole('button', { name: /3 PM to 1 AM$/ })).toHaveCount(1);
});
