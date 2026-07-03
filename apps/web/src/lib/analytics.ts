declare global {
  interface Window {
    plausible?: (event: string, options?: { props?: Record<string, unknown> }) => void;
  }
}

export function trackEvent(name: string, props?: Record<string, unknown>): void {
  if (typeof window === 'undefined' || !window.plausible) return;
  window.plausible(name, props ? { props } : undefined);
}

export const trackVerify = (certId: string) =>
  trackEvent('Verify', { certId });

export const trackGovernanceVote = (proposalId: string) =>
  trackEvent('GovernanceVote', { proposalId });
