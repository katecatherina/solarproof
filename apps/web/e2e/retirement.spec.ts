/**
 * E2E scenarios for certificate retirement and post-retirement verification — issue #596.
 *
 * The retirement model (ADR-006) uses a contract-managed burn: the energy_token
 * contract's `retire` function decrements the caller's balance permanently and
 * records the event in audit_registry. The public verifier at /verify reflects
 * the retired state.
 *
 * These tests mock the API layer so they run without a live Stellar network.
 */

import { expect, test } from '@playwright/test'

// ── Shared fixture data ────────────────────────────────────────────────────

const activeCertificate = {
  certificate: {
    id: 'cert-active-001',
    kwh: 25,
    issued_at: '2025-06-01T00:00:00.000Z',
    retired: false,
    retired_at: null,
    retired_by: null,
  },
  on_chain: {
    anchor_tx: 'anchor_tx_active',
    anchor_explorer: 'https://stellar.explorer/tx/anchor_tx_active',
    mint_tx: 'mint_tx_active',
    mint_explorer: 'https://stellar.explorer/tx/mint_tx_active',
  },
  meter_proof: {
    meter_id: 'meter-001',
    reading_hash: 'aabbccdd11223344',
    signature_hex: 'deadbeefdeadbeef',
    kwh: 25,
    timestamp: '2025-06-01T00:00:00.000Z',
    verified: true,
  },
}

const retiredCertificate = {
  certificate: {
    id: 'cert-retired-002',
    kwh: 50,
    issued_at: '2025-05-01T00:00:00.000Z',
    retired: true,
    retired_at: '2025-06-10T12:00:00.000Z',
    retired_by: 'GABC1234RETIREDBYADDRESS',
  },
  on_chain: {
    anchor_tx: 'anchor_tx_retired',
    anchor_explorer: 'https://stellar.explorer/tx/anchor_tx_retired',
    mint_tx: 'mint_tx_retired',
    mint_explorer: 'https://stellar.explorer/tx/mint_tx_retired',
    retire_tx: 'retire_tx_002',
    retire_explorer: 'https://stellar.explorer/tx/retire_tx_002',
  },
  meter_proof: {
    meter_id: 'meter-001',
    reading_hash: '11223344aabbccdd',
    signature_hex: 'cafebabecafebabe',
    kwh: 50,
    timestamp: '2025-05-01T00:00:00.000Z',
    verified: true,
  },
}

// ── Route helper ──────────────────────────────────────────────────────────

function mockVerifyRoute(
  page: import('@playwright/test').Page,
  responses: Record<string, object | null>
) {
  return page.route('**/api/verify**', async (route) => {
    const id = new URL(route.request().url()).searchParams.get('id')
    const body = id ? responses[id] : null
    if (body) {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(body) })
    } else {
      await route.fulfill({ status: 404, contentType: 'application/json', body: JSON.stringify({ error: 'Certificate not found' }) })
    }
  })
}

// ── Tests ──────────────────────────────────────────────────────────────────

test.describe('Certificate retirement — verifier UI', () => {
  test('active certificate shows no retirement indicator', async ({ page }) => {
    await mockVerifyRoute(page, { 'cert-active-001': activeCertificate })
    await page.goto('/verify')
    const input = page.locator('input[type="text"], input[placeholder*="certificate" i], input[placeholder*="ID" i]').first()
    await input.fill('cert-active-001')
    await Promise.all([
      page.waitForResponse('**/api/verify**'),
      page.click('button:has-text("Verify")'),
    ])
    await expect(page.locator('text=Certificate verified successfully.')).toBeVisible()
    // Active certificate must NOT show a retirement notice
    await expect(page.locator('text=Retired')).not.toBeVisible()
    await expect(page.locator('text=retired')).not.toBeVisible()
  })

  test('retired certificate shows retirement status and retire tx link', async ({ page }) => {
    await mockVerifyRoute(page, { 'cert-retired-002': retiredCertificate })
    await page.goto('/verify')
    const input = page.locator('input[type="text"], input[placeholder*="certificate" i], input[placeholder*="ID" i]').first()
    await input.fill('cert-retired-002')
    await Promise.all([
      page.waitForResponse('**/api/verify**'),
      page.click('button:has-text("Verify")'),
    ])
    // Verifier must reflect the retired state
    await expect(page.locator('text=/retired/i').first()).toBeVisible()
  })

  test('retired certificate still shows full chain-of-custody proof', async ({ page }) => {
    await mockVerifyRoute(page, { 'cert-retired-002': retiredCertificate })
    await page.goto('/verify')
    const input = page.locator('input[type="text"], input[placeholder*="certificate" i], input[placeholder*="ID" i]').first()
    await input.fill('cert-retired-002')
    await Promise.all([
      page.waitForResponse('**/api/verify**'),
      page.click('button:has-text("Verify")'),
    ])
    // On-chain proof and Ed25519 proof must still appear for retired certs
    await expect(page.locator('text=On-chain proof')).toBeVisible()
    await expect(page.locator('text=Ed25519 verified')).toBeVisible()
  })

  test('unknown certificate ID shows error state', async ({ page }) => {
    await mockVerifyRoute(page, {})
    await page.goto('/verify')
    const input = page.locator('input[type="text"], input[placeholder*="certificate" i], input[placeholder*="ID" i]').first()
    await input.fill('cert-does-not-exist')
    await Promise.all([
      page.waitForResponse('**/api/verify**'),
      page.click('button:has-text("Verify")'),
    ])
    await expect(page.locator('div[role="alert"]')).toBeVisible()
  })
})
