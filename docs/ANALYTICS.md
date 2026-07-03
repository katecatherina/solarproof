# Analytics

SolarProof uses [Plausible Analytics](https://plausible.io) — a privacy-first, cookieless analytics tool that is GDPR-compliant out of the box.

## What is tracked

| Event | Trigger | Properties |
|---|---|---|
| `Verify` | User submits a certificate ID on `/verify` | `certId` |
| `GovernanceVote` | User casts a vote on `/governance` | `proposalId` |

No personal data, IP addresses, or cookies are collected.

## How to enable Plausible

1. Create a site in your [Plausible dashboard](https://plausible.io/sites).
2. Set the environment variable:
   ```
   NEXT_PUBLIC_PLAUSIBLE_DOMAIN=yourdomain.com
   ```
3. Add the Plausible script to `apps/web/src/app/layout.tsx`:
   ```tsx
   {process.env.NEXT_PUBLIC_PLAUSIBLE_DOMAIN && (
     <Script
       defer
       data-domain={process.env.NEXT_PUBLIC_PLAUSIBLE_DOMAIN}
       src="https://plausible.io/js/script.js"
     />
   )}
   ```

## Privacy

- **No cookies** — Plausible does not use cookies or persistent identifiers.
- **No PII** — event properties contain only opaque IDs (`certId`, `proposalId`), never user-identifiable data.
- **GDPR / CCPA compliant** — no consent banner required.
- **Self-hostable** — Plausible can be self-hosted if your deployment requires data residency controls.
