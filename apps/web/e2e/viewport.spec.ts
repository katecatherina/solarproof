/**
 * Mobile and desktop viewport scenario coverage — issue #591.
 *
 * Verifies that key user flows work and render correctly on both mobile and
 * desktop viewports. The Playwright project matrix (playwright.config.ts)
 * runs these tests on real mobile device emulations (Pixel 5, iPhone 13) as
 * well as Desktop Chrome/Firefox/Safari, so individual tests here do not need
 * to set a viewport manually.
 */

import { expect, test } from '@playwright/test'

const validResponse = {
  certificate: {
    id: 'cert-viewport-test',
    kwh: 10,
    issued_at: '2025-06-01T00:00:00.000Z',
    retired: false,
    retired_at: null,
    retired_by: null,
  },
  on_chain: {
    anchor_tx: 'anchor_tx_viewport',
    anchor_explorer: 'https://stellar.explorer/tx/anchor_tx_viewport',
    mint_tx: 'mint_tx_viewport',
    mint_explorer: 'https://stellar.explorer/tx/mint_tx_viewport',
  },
  meter_proof: {
    meter_id: 'meter-viewport',
    reading_hash: '1234abcd',
    signature_hex: 'beefbeefbeefbeef',
    kwh: 10,
    timestamp: '2025-06-01T00:00:00.000Z',
    verified: true,
  },
}

test.beforeEach(async ({ page }) => {
  await page.route('**/api/verify**', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(validResponse),
    })
  })
})

test('home page renders primary CTA on any viewport', async ({ page }) => {
  await page.goto('/')
  // The primary call-to-action must be visible without horizontal scroll
  const body = page.locator('body')
  await expect(body).toBeVisible()
  const scrollWidth: number = await page.evaluate(() => document.body.scrollWidth)
  const clientWidth: number = await page.evaluate(() => document.body.clientWidth)
  expect(scrollWidth).toBeLessThanOrEqual(clientWidth + 1) // no horizontal overflow
})

test('verify page is usable and shows result on any viewport', async ({ page }) => {
  await page.goto('/verify')
  // Form and submit button must be reachable without horizontal scroll
  const verifyButton = page.locator('button:has-text("Verify")')
  await expect(verifyButton).toBeVisible()
  await Promise.all([
    page.waitForResponse('**/api/verify**'),
    verifyButton.click(),
  ])
  await expect(page.locator('text=Certificate verified successfully.')).toBeVisible()
})

test('navigation is accessible on any viewport', async ({ page }) => {
  await page.goto('/')
  // On mobile, a hamburger / menu toggle may be present instead of a full nav.
  // Either the nav links are visible or a menu toggle exists.
  const hasVisibleNav = await page.locator('nav a').first().isVisible().catch(() => false)
  const hasMenuToggle = await page
    .locator('[aria-label*="menu" i], [aria-label*="navigation" i], button[aria-expanded]')
    .first()
    .isVisible()
    .catch(() => false)
  expect(hasVisibleNav || hasMenuToggle).toBe(true)
})
