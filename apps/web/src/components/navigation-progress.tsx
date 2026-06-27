'use client'

import { useEffect, useRef, useState } from 'react'
import { usePathname } from 'next/navigation'

/**
 * Thin top-of-page progress bar that fires on every pathname change.
 * Works with both server and client navigations in the Next.js App Router.
 *
 * Implementation: races a CSS transition from 0 → 80% immediately on route
 * change, then completes to 100% and fades out once the new pathname is
 * committed (i.e. the component re-renders with the updated pathname).
 */
export function NavigationProgress() {
  const pathname = usePathname()
  const [progress, setProgress] = useState(0)
  const [visible, setVisible] = useState(false)
  const prevPathname = useRef(pathname)
  const completeTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    if (pathname === prevPathname.current) return
    prevPathname.current = pathname

    // Clear any in-flight timers from a previous navigation
    if (completeTimer.current) clearTimeout(completeTimer.current)
    if (hideTimer.current) clearTimeout(hideTimer.current)

    // Start: snap to 0, show bar, animate to 80%
    setProgress(0)
    setVisible(true)
    // rAF ensures the 0% paint happens before we kick off the transition
    requestAnimationFrame(() => setProgress(80))

    // Complete: advance to 100% then fade out
    completeTimer.current = setTimeout(() => {
      setProgress(100)
      hideTimer.current = setTimeout(() => setVisible(false), 300)
    }, 200)

    return () => {
      if (completeTimer.current) clearTimeout(completeTimer.current)
      if (hideTimer.current) clearTimeout(hideTimer.current)
    }
  }, [pathname])

  if (!visible) return null

  return (
    <div
      role="progressbar"
      aria-label="Page loading"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={progress}
      className="pointer-events-none fixed inset-x-0 top-0 z-[9999] h-0.5"
    >
      <div
        className="h-full bg-yellow-400 transition-all duration-200 ease-out"
        style={{ width: `${progress}%` }}
      />
    </div>
  )
}
