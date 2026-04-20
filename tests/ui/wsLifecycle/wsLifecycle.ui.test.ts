import { test, expect } from '@playwright/test';

test('WS lifecycle UI interactions (scaffold)', async ({ page }) => {
  // This is a scaffold Playwright test. Point to your UI URL in the real project.
  await page.goto('http://localhost:3000/ws-lifecycle');
  await expect(page.locator('#ws-status')).toHaveText('idle');
  await page.click('#start-ws');
  await expect(page.locator('#ws-status')).toHaveText('connected');
  await page.click('#stop-ws');
  await expect(page.locator('#ws-status')).toHaveText('disconnected');
});
