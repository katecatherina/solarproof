/**
 * useMetrics — lightweight hook for tracking critical-path user interactions.
 *
 * Sends named timing events to Vercel Analytics (track) so they appear
 * alongside page-view and Web Vitals data in the Vercel dashboard.
 *
 * Usage:
 *   const { trackTiming } = useMetrics()
 *   const end = trackTiming.start('verify_lookup')
 *   await doExpensiveWork()
 *   end()   // records duration
 */

import { track } from '@vercel/analytics'

export function useMetrics() {
  return { trackTiming: { start: startTiming } }
}

/**
 * Start a timing measurement. Returns a function that, when called,
 * sends the elapsed milliseconds to Vercel Analytics.
 */
function startTiming(name: string): () => void {
  const t0 = performance.now()
  return () => {
    const duration = Math.round(performance.now() - t0)
    track(name, { duration_ms: duration })
  }
}

/**
 * Fire-and-forget event tracker for discrete user actions.
 */
export function trackEvent(name: string, props?: Record<string, string | number | boolean>) {
  track(name, props)
}
