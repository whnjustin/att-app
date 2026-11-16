import { expect, test } from '@playwright/test';

test('overview and plan stubs render on the mock store', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));

  await page.goto('./?mock=1&reset=1#/');
  await expect(page.getByRole('heading', { name: "Who's here" })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Routes' })).toBeVisible();

  await page.goto('./?mock=1#/plan/2026-11-20');
  await expect(page.getByRole('heading', { name: 'Places' })).toBeVisible();

  expect(errors).toEqual([]);
});
