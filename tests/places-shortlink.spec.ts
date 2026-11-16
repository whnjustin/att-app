import { expect, test, type Page } from '@playwright/test';

const EMPTY_STYLE = JSON.stringify({
  version: 8,
  sources: {},
  layers: [{ id: 'bg', type: 'background', paint: { 'background-color': '#e8e8e8' } }],
});

const FINAL =
  'https://www.google.com/maps/place/Some+Cafe/@3.1478,101.7130,17z/data=!3m1!4b1!4m6!3m5!1s0x0:0x0!8m2!3d3.1479!4d101.7131';

const PROXIES = /api\.allorigins\.win|corsproxy\.io|codetabs\.com|unshorten\.me/;

async function stubStyle(page: Page) {
  await page.route(/tiles\.openfreemap\.org/, (r) =>
    r.request().url().includes('/styles/')
      ? r.fulfill({ contentType: 'application/json', body: EMPTY_STYLE })
      : r.abort(),
  );
}

test('search shows Searching while Photon is in flight', async ({ page }) => {
  await stubStyle(page);
  await page.route(/photon\.komoot\.io/, async (r) => {
    await new Promise((res) => setTimeout(res, 2500));
    await r.fulfill({
      contentType: 'application/json',
      body: JSON.stringify({ type: 'FeatureCollection', features: [] }),
    });
  });
  await page.goto('./?mock=1&reset=1#/plan/2026-11-19');
  await page.getByRole('button', { name: 'Add place' }).click();
  const sheet = page.getByRole('dialog');
  await sheet.getByLabel('Search places').fill('cafe');
  await expect(sheet.getByText('Searching')).toBeVisible();
  await page.screenshot({ path: process.env.SHOT_DIR ? `${process.env.SHOT_DIR}/searching.png` : undefined });
  await expect(sheet.getByText('Not found')).toBeVisible({ timeout: 8000 });
  await expect(sheet.getByText('Searching')).toBeHidden();
});

test('short Google Maps link resolves and fills the form', async ({ page }) => {
  await stubStyle(page);
  await page.route(/api\.allorigins\.win/, async (r) => {
    await new Promise((res) => setTimeout(res, 1200));
    await r.fulfill({
      contentType: 'application/json',
      headers: { 'access-control-allow-origin': '*' },
      body: JSON.stringify({ status: { url: FINAL }, contents: '<html></html>' }),
    });
  });
  await page.goto('./?mock=1&reset=1#/plan/2026-11-19');
  await page.getByRole('button', { name: 'Add place' }).click();
  const sheet = page.getByRole('dialog');
  await sheet.getByRole('button', { name: 'Paste Google Maps link' }).click();
  await sheet.getByLabel('Link').fill('https://maps.app.goo.gl/PlaceholderId?g_st=ic');
  await expect(sheet.getByText('Opening link')).toBeVisible();
  await page.screenshot({ path: process.env.SHOT_DIR ? `${process.env.SHOT_DIR}/opening.png` : undefined });
  await expect(sheet.getByLabel('Name')).toHaveValue('Some Cafe');
  await expect(sheet.getByText('Opening link')).toBeHidden();
  await page.screenshot({ path: process.env.SHOT_DIR ? `${process.env.SHOT_DIR}/filled.png` : undefined });
});

test('failed short link shows Could not open link', async ({ page }) => {
  await stubStyle(page);
  await page.route(PROXIES, (r) => r.abort());
  await page.goto('./?mock=1&reset=1#/plan/2026-11-19');
  await page.getByRole('button', { name: 'Add place' }).click();
  const sheet = page.getByRole('dialog');
  await sheet.getByRole('button', { name: 'Paste Google Maps link' }).click();
  await sheet.getByLabel('Link').fill('https://maps.app.goo.gl/PlaceholderId');
  await expect(sheet.getByText('Could not open link')).toBeVisible();
});

test('consent redirect with only a place text is geocoded', async ({ page }) => {
  await stubStyle(page);
  const consent =
    'https://consent.google.com/ml?continue=https://maps.google.com/maps?q%3DSome%2BCafe%2B@%2BArea,%2B6,%2BJln%2BTest%2B4,%2BArea%26ftid%3D0x1:0x2&hl=en';
  await page.route(PROXIES, (r) =>
    r.request().url().includes('unshorten.me')
      ? r.fulfill({
          contentType: 'application/json',
          headers: { 'access-control-allow-origin': '*' },
          body: JSON.stringify({ success: true, resolved_url: consent }),
        })
      : r.abort(),
  );
  await page.route(/photon\.komoot\.io/, (r) => {
    const q = new URL(r.request().url()).searchParams.get('q') ?? '';
    const features = q.startsWith('Jalan Test 4')
      ? [
          {
            geometry: { type: 'Point', coordinates: [101.67, 3.13] },
            properties: { name: 'Jalan Test 4', osm_type: 'W', osm_id: 1, locality: 'Area' },
          },
        ]
      : [];
    return r.fulfill({ contentType: 'application/json', body: JSON.stringify({ features }) });
  });
  await page.goto('./?mock=1&reset=1#/plan/2026-11-19');
  await page.getByRole('button', { name: 'Add place' }).click();
  const sheet = page.getByRole('dialog');
  await sheet.getByRole('button', { name: 'Paste Google Maps link' }).click();
  await sheet.getByLabel('Link').fill('https://maps.app.goo.gl/PlaceholderId?g_st=ic');
  await expect(sheet.getByLabel('Name')).toHaveValue('Some Cafe @ Area');
});
