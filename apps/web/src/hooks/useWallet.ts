'use client'

import { useCallback, useEffect, useRef, useState } from 'react'

const STORAGE_KEY = 'solarproof-wallet'

/**
 * How often (ms) to poll Freighter's isAllowed() while a wallet is connected.
 * Keeps UI state in sync if the user locks their extension or switches account.
 * 30 s is intentionally infrequent — it only fires while the tab is active.
 */
const SESSION_POLL_MS = 30_000

interface WalletState {
  address: string | null
  connected: boolean
}

const initial: WalletState = { address: null, connected: false }

function isFreighterAvailable(): boolean {
  return typeof window !== 'undefined' && 'freighter' in window
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function getFreighter(): any {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (window as any).freighter
}

/**
 * Clears all stale wallet/session data from sessionStorage.
 * Call this whenever a session expires or the wallet is explicitly disconnected.
 */
function clearPersistedSession(): void {
  sessionStorage.removeItem(STORAGE_KEY)
}

export function useWallet() {
  const [state, setState] = useState<WalletState>(initial)
  const [loading, setLoading] = useState(true)
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)

  /** Stop the background session-validity poll. */
  function stopPoll() {
    if (pollRef.current !== null) {
      clearInterval(pollRef.current)
      pollRef.current = null
    }
  }

  /**
   * Immediately wipe all in-memory and persisted state and stop polling.
   * Used internally when a session expires so no stale data lingers.
   */
  const expireSession = useCallback(() => {
    stopPoll()
    setState(initial)
    clearPersistedSession()
  }, [])

  /**
   * Start polling Freighter's isAllowed() every SESSION_POLL_MS while the tab
   * is visible. Immediately expires the session if the wallet is no longer
   * authorised (e.g. the user locked Freighter or removed the permission).
   */
  const startPoll = useCallback(() => {
    stopPoll()
    if (!isFreighterAvailable()) return

    pollRef.current = setInterval(async () => {
      // Only poll while the tab is visible to save battery / requests.
      if (document.visibilityState === 'hidden') return

      try {
        const freighter = getFreighter()
        const isAllowed: boolean = await freighter.isAllowed()
        if (!isAllowed) {
          expireSession()
        } else {
          // If the user switched accounts, pick up the new public key.
          const currentAddress: string = await freighter.getPublicKey()
          setState((prev) => {
            if (prev.address !== currentAddress) {
              const next: WalletState = { address: currentAddress, connected: true }
              sessionStorage.setItem(STORAGE_KEY, JSON.stringify(next))
              return next
            }
            return prev
          })
        }
      } catch {
        // Network / extension error — treat as expired to be safe.
        expireSession()
      }
    }, SESSION_POLL_MS)
  }, [expireSession])

  // ── Restore persisted state on mount ───────────────────────────────────────
  useEffect(() => {
    async function restore() {
      try {
        const stored = sessionStorage.getItem(STORAGE_KEY)
        if (!stored) return

        const { address } = JSON.parse(stored) as WalletState
        if (!address || !isFreighterAvailable()) {
          clearPersistedSession()
          return
        }

        // Re-check authorisation without prompting the user.
        const freighter = getFreighter()
        const isAllowed: boolean = await freighter.isAllowed()
        if (isAllowed) {
          // Verify the persisted address still matches the active account.
          const currentAddress: string = await freighter.getPublicKey()
          setState({ address: currentAddress, connected: true })
          startPoll()
        } else {
          // Session was invalid — clear everything so stale data never shows.
          clearPersistedSession()
        }
      } catch {
        clearPersistedSession()
      } finally {
        setLoading(false)
      }
    }
    restore()

    return () => stopPoll()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // ── Visibility-change listener ─────────────────────────────────────────────
  // Re-check session immediately when the user returns to the tab so stale
  // state is never shown even if the poll timer hasn't fired yet.
  useEffect(() => {
    async function handleVisibilityChange() {
      if (document.visibilityState !== 'visible') return
      if (!state.connected || !isFreighterAvailable()) return

      try {
        const freighter = getFreighter()
        const isAllowed: boolean = await freighter.isAllowed()
        if (!isAllowed) {
          expireSession()
        }
      } catch {
        expireSession()
      }
    }

    document.addEventListener('visibilitychange', handleVisibilityChange)
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange)
  }, [state.connected, expireSession])

  // ── connect ────────────────────────────────────────────────────────────────
  const connect = useCallback(async () => {
    if (!isFreighterAvailable()) {
      throw new Error('Freighter wallet extension not found. Please install it.')
    }
    const freighter = getFreighter()
    await freighter.requestAccess()
    const address: string = await freighter.getPublicKey()
    const next: WalletState = { address, connected: true }
    setState(next)
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(next))
    startPoll()
    return address
  }, [startPoll])

  // ── disconnect ─────────────────────────────────────────────────────────────
  const disconnect = useCallback(() => {
    expireSession()
  }, [expireSession])

  return { ...state, loading, connect, disconnect }
}
