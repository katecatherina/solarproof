# Color Contrast Audit & Improvements (#533)

This document records the audit plan and suggested remediations to improve color contrast across the web app for accessibility.

## Goals

- Ensure text and UI components meet WCAG AA contrast ratios (4.5:1 for normal text, 3:1 for large text).
- Provide a prioritized list of components and pages to fix.

## Audit Plan

1. Run automated contrast checks against page screenshots (e.g., use pa11y, axe-core, or Lighthouse).
2. Manually inspect components with custom styling (buttons, badges, charts) to confirm color ratios.
3. Produce a prioritized remediation list: critical (navigation, forms), important (cards, primary CTAs), cosmetic.

## Suggested Remediations

- Replace low-contrast text colors with accessible tokens in `apps/web/src/styles` and `globals.css`.
- Use `prefers-contrast` media query to offer stronger contrast for users who request it.
- Update Tailwind config color palette to include accessible token variants and use them across components.

## Verification

- Re-run automated checks after fixes.
- Add unit visual tests or screenshot tests in `apps/web/e2e` to prevent regressions.

Link to issue: #533
