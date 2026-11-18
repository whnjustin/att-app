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

test('hold and swipe left onto the remove target removes the item from the day only', async ({ page }) => {
  await page.goto('./?mock=1&reset=1#/plan/2026-11-20');
  const item = page.getByRole('button', { name: /3 PM to 4 PM$/ });
  await item.scrollIntoViewIfNeeded();
  const box = (await item.boundingBox())!;
  const x = box.x + 30;
  const y = box.y + box.height / 2;
  await page.mouse.move(x, y);
  await page.mouse.down();
  await page.mouse.move(x, y + 6);
  const target = page.locator('.tl-remove');
  await expect(target).toBeVisible();
  await expect(target).not.toHaveClass(/active/);
  await page.mouse.move(box.x - 30, y + 6, { steps: 4 });
  await expect(target).toHaveClass(/active/);
  await page.mouse.up();
  await expect(item).toHaveCount(0);
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(page.locator('#place-mock-cafe')).toHaveCount(1);
});

test('dragging back out of the remove target keeps the item', async ({ page }) => {
  await page.goto('./?mock=1&reset=1#/plan/2026-11-20');
  const item = page.getByRole('button', { name: /3 PM to 4 PM$/ });
  await item.scrollIntoViewIfNeeded();
  const box = (await item.boundingBox())!;
  const x = box.x + 30;
  const y = box.y + box.height / 2;
  await page.mouse.move(x, y);
  await page.mouse.down();
  await page.mouse.move(box.x - 30, y, { steps: 4 });
  await page.mouse.move(x, y, { steps: 4 });
  await page.mouse.up();
  await expect(page.locator('.tl-remove')).toHaveCount(0);
  await expect(item).toHaveCount(1);
});

test('a long press without moving does not open the item', async ({ page, browserName }) => {
  test.skip(browserName !== 'chromium');
  await page.goto('./?mock=1&reset=1#/plan/2026-11-20');
  const item = page.getByRole('button', { name: /3 PM to 4 PM$/ });
  await item.scrollIntoViewIfNeeded();
  const box = (await item.boundingBox())!;
  const pt = { x: box.x + 30, y: box.y + box.height / 2 };
  const cdp = await page.context().newCDPSession(page);
  await cdp.send('Emulation.setTouchEmulationEnabled', { enabled: true, maxTouchPoints: 1 });
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [pt] });
  await page.waitForTimeout(500);
  await expect(page.locator('.tl-remove')).toBeVisible();
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  // A late click, as iOS sends after a long press.
  await page.waitForTimeout(100);
  await item.dispatchEvent('click');
  await page.waitForTimeout(500);
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(page.locator('#place-mock-cafe .row-button')).toHaveAttribute('aria-expanded', 'false');
});
