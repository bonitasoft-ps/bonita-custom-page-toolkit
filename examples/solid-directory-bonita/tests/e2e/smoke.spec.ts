import { test, expect } from '@playwright/test';

test('home loads without console errors', async ({ page }) => {
  const errors: string[] = [];
  page.on('console', (msg) => {
    if (msg.type() === 'error') errors.push(msg.text());
  });
  await page.goto('/');
  await expect(page.locator('#app, body')).toBeVisible();
  expect(errors).toEqual([]);
});
