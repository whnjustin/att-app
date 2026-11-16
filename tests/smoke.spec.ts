import { expect, test, type Page } from '@playwright/test';

const EMPTY_STYLE = JSON.stringify({
  version: 8,
  sources: {},
  layers: [{ id: 'bg', type: 'background', paint: { 'background-color': '#e8e8e8' } }],
});

const PHOTON = JSON.stringify({
  type: 'FeatureCollection',
  features: [
    {
      type: 'Feature',
      geometry: { type: 'Point', coordinates: [101.705, 3.146] },
      properties: {
        name: 'Test Satay House',
        osm_type: 'N',
        osm_id: 4242,
        osm_key: 'amenity',
        osm_value: 'restaurant',
        district: 'Area Z',
        city: 'Kuala Lumpur',
      },
    },
  ],
});

async function stubNetwork(page: Page) {
  await page.route(/tiles\.openfreemap\.org/, (r) =>
    r.request().url().includes('/styles/')
      ? r.fulfill({ contentType: 'application/json', body: EMPTY_STYLE })
      : r.abort(),
  );
  await page.route(/photon\.komoot\.io/, (r) => r.fulfill({ contentType: 'application/json', body: PHOTON }));
  await page.route(/router\.project-osrm\.org/, (r) => r.abort());
  await page.route(/google\.com/, (r) => r.abort());
}

test('mock app end to end', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await stubNetwork(page);

  // Overview: 6 people rows and the map section.
  await page.goto('./?mock=1&reset=1#/');
  await expect(page.locator('.arr-row')).toHaveCount(6);
  await expect(page.getByRole('heading', { name: 'Routes' })).toBeVisible();

  // Plan: 2 meal blocks on each of the 4 days.
  await page.goto('./?mock=1#/plan/2026-11-19');
  for (const day of ['Thu 19', 'Fri 20', 'Sat 21', 'Sun 22']) {
    await page.getByRole('radio', { name: day }).first().click();
    await expect(page.getByRole('button', { name: /12 PM to 1 PM$/ })).toHaveCount(1);
    await expect(page.getByRole('button', { name: /8 PM to 9 PM$/ })).toHaveCount(1);
  }

  // Add a place via mocked search, then add it to Fri 20.
  await page.getByRole('button', { name: 'Add place' }).click();
  await page.getByLabel('Search places').fill('satay');
  await page.getByRole('button', { name: /Test Satay House/ }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Save' }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await page.getByRole('button', { name: 'Add Test Satay House to day plan' }).click();
  const sheet = page.getByRole('dialog');
  await sheet.getByRole('radio', { name: 'Fri 20' }).click();
  await sheet.getByRole('button', { name: 'Save' }).click();

  // Map leg list for Fri 20 now includes the new place.
  await page.goto('./?mock=1#/');
  await page.getByRole('radio', { name: 'Fri 20' }).click();
  await expect(page.locator('.leg-list').getByText('Test Satay House').first()).toBeVisible({
    timeout: 10_000,
  });

  expect(errors).toEqual([]);
});
