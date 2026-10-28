import { test, expect } from '@playwright/test';

test('Mi primer test en Playwright', async ({ page }) => {
  await page.goto('https://playwright.dev/');
  await expect(page).toHaveTitle(/Playwright/);
});
