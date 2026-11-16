import { expect, test } from '@playwright/test';

const EMPTY_STYLE = JSON.stringify({
  version: 8,
  sources: {},
  layers: [{ id: 'bg', type: 'background', paint: { 'background-color': '#e8e8e8' } }],
});

test('empty search shows Not found and a paste link shortcut', async ({ page }) => {
  await page.route(/tiles\.openfreemap\.org/, (r) =>
    r.request().url().includes('/styles/')
      ? r.fulfill({ contentType: 'application/json', body: EMPTY_STYLE })
      : r.abort(),
  );
  await page.route(/photon\.komoot\.io/, (r) =>
    r.fulfill({
      contentType: 'application/json',
      body: JSON.stringify({ type: 'FeatureCollection', features: [] }),
    }),
  );
  await page.goto('./?mock=1&reset=1#/plan/2026-11-19');
  await page.getByRole('button', { name: 'Add place' }).click();
  const sheet = page.getByRole('dialog');
  await sheet.getByLabel('Search places').fill('zzzz');
  await expect(sheet.getByText('Not found')).toBeVisible();
  await sheet.getByRole('button', { name: 'Paste a Google Maps link' }).click();
  await expect(sheet.getByRole('button', { name: 'Paste Google Maps link' })).toHaveAttribute(
    'aria-expanded',
    'true',
  );
  await expect(sheet.getByLabel('Link')).toBeFocused();
});
