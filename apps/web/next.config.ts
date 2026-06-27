import type { NextConfig } from 'next'
import { validateEnv } from './src/lib/env'

// Validate required secrets at startup — fails fast with a clear message
// rather than silent runtime errors. Skip during static analysis / type-check.
if (process.env.NODE_ENV !== 'test') {
  validateEnv()
}

const nextConfig: NextConfig = {
  transpilePackages: ['@solarproof/stellar'],
  serverExternalPackages: ['@stellar/stellar-sdk'],
}

export default nextConfig
