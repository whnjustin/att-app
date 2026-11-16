import { expect, test } from '@playwright/test';

const EMPTY_STYLE = JSON.stringify({
  version: 8,
  sources: {},
  layers: [{ id: 'bg', type: 'background', paint: { 'background-color': '#e8e8e8' } }],
});

test('tapping a stop row opens its card with Waze', async ({ page }) => {
  await page.route(/tiles\.openfreemap\.org/, (r) =>
    r.request().url().includes('/styles/')
      ? r.fulfill({ contentType: 'application/json', body: EMPTY_STYLE })
      : r.abort(),
  );
  await page.route(/router\.project-osrm\.org|photon\.komoot\.io/, (r) => r.abort());
  await page.goto('./?mock=1&reset=1#/');
  await page
    .getByRole('radio', { name: 'Fri 20' })
    .or(page.getByRole('tab', { name: 'Fri 20' }))
    .or(page.getByRole('button', { name: 'Fri 20' }))
    .first()
    .click();
  const row = page.getByRole('button', { name: /, stop 1 of \d+$/ });
  const name = ((await row.getAttribute('aria-label')) ?? '').replace(/, stop 1 of \d+$/, '');
  await row.click();
  const card = page.getByRole('dialog', { name });
  await expect(card).toBeVisible();
  await expect(card.getByRole('link', { name: 'Waze' })).toHaveAttribute('href', /waze\.com/);
  await expect(card.getByRole('link', { name: 'Google Maps' })).toBeVisible();
});
