import { test, expect } from '@playwright/test';

test('Corporate website loads', async ({ page }) => {
  const response = await page.goto('http://localhost:3000/');
  expect(response?.status()).toBeLessThan(400);
  await expect(page.locator('body')).toBeVisible();
});

test('Backoffice loads', async ({ page }) => {
  const response = await page.goto('http://localhost:3001/backoffice/');
  expect(response?.status()).toBeLessThan(400);
  await expect(page.locator('body')).toBeVisible();
});