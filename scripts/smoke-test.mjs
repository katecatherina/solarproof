#!/usr/bin/env node
/**
 * scripts/smoke-test.mjs
 *
 * Post-deployment smoke test. Hits critical endpoints and exits non-zero
 * if any check fails, causing the deployment job to fail.
 *
 * Usage:
 *   node scripts/smoke-test.mjs https://solarproof.vercel.app
 */

const BASE_URL = process.argv[2]?.replace(/\/$/, '')

if (!BASE_URL) {
  console.error('Usage: node scripts/smoke-test.mjs <BASE_URL>')
  process.exit(1)
}

const checks = [
  {
    name: 'Health endpoint returns ok',
    url: `${BASE_URL}/api/health`,
    validate: (json) => json.status === 'ok',
  },
  {
    name: 'Home page loads (200)',
    url: `${BASE_URL}/`,
    validate: null, // just checks HTTP 200
  },
  {
    name: 'Dashboard page loads (200)',
    url: `${BASE_URL}/dashboard`,
    validate: null,
  },
  {
    name: 'Verify page loads (200)',
    url: `${BASE_URL}/verify`,
    validate: null,
  },
  {
    name: 'Certificates API returns JSON',
    url: `${BASE_URL}/api/certificates?limit=1`,
    validate: (json) => Array.isArray(json.certificates),
  },
]

let passed = 0
let failed = 0

for (const check of checks) {
  try {
    const res = await fetch(check.url, { redirect: 'follow' })
    if (!res.ok) throw new Error(`HTTP ${res.status}`)

    if (check.validate) {
      const json = await res.json()
      if (!check.validate(json)) throw new Error(`Validation failed: ${JSON.stringify(json)}`)
    }

    console.log(`  ✓ ${check.name}`)
    passed++
  } catch (err) {
    console.error(`  ✗ ${check.name}: ${err.message}`)
    failed++
  }
}

console.log(`\nSmoke test: ${passed} passed, ${failed} failed`)
if (failed > 0) process.exit(1)
