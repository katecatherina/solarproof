# Accessibility & Responsiveness Audit

**Standard:** WCAG 2.1 AA  
**Date:** 2026-06-27  
**Scope:** `apps/web` — all public-facing and authenticated pages

---

## Summary

| Area | Status |
|---|---|
| Semantic HTML & landmarks | ✅ Covered |
| Keyboard navigation | ✅ Mostly covered — gaps in modal focus trap |
| Screen reader support | ✅ Mostly covered — gaps noted below |
| Colour contrast | ⚠️ Partial — see #533 |
| Forms & labels | ✅ Covered (post #480, #486) |
| Modal / dialog accessibility | ⚠️ Partial — Escape key and focus return (see #483) |
| Responsive layout | ⚠️ Partial — admin page not fully mobile-friendly (see #541) |
| Localisation / RTL | ⚠️ Pending — RTL layout not tested |

---

## Covered Requirements

### Semantic HTML
- All pages use `<header>`, `<main>`, `<nav>` landmarks (via `navbar.tsx` and layout).
- Interactive elements use `<button>` and `<a>` with appropriate roles.
- Form fields have associated `<label>` elements throughout.

### Keyboard Navigation
- All navigation links and action buttons are Tab-reachable.
- Verify page (#480): proof steps are in a labelled `<ol>`, each step has `aria-label` with name + status, explorer links are keyboard-accessible.
- Language selector (#486): native `<select>` is keyboard-operable; labelled via `<label htmlFor>`.
- Certificate, dashboard, meters, governance pages: all primary CTAs reachable by Tab.

### Screen Reader Support
- Live regions (`aria-live="polite"`, `role="status"`) used for:
  - Verify page result summary (#480)
  - Language change announcement (#486)
  - Toast notifications (`toast.tsx`)
  - Loading states on skeleton components
- Icon-only buttons have `aria-label` (e.g. copy button, share button).
- Decorative icons marked `aria-hidden="true"` throughout.

### Forms
- All `<input>`, `<select>`, `<textarea>` elements have `<label>` or `aria-label`.
- Validation errors use `role="alert"` for immediate announcement.
- Search form on verify page uses `aria-required` and `aria-busy`.

### Responsive Layout
- Verify page, dashboard, certificates: use Tailwind responsive prefixes (`sm:`, `md:`).
- Navbar collapses to mobile-friendly layout on small viewports.

---

## Known Gaps

### 1. Modal / dialog dismissal — #483 (High)

**Components:** `retire-modal.tsx`, `transfer-modal.tsx`

| Issue | Impact |
|---|---|
| Escape key does not close modals | Keyboard users cannot dismiss without Tab-navigating to Cancel |
| Focus is not trapped inside open modal | Tab leaves the modal and reaches background content |
| Focus does not return to triggering button after close | Keyboard position is lost after dismissal |
| Close button label is `"Close"` — acceptable, but could be more descriptive (e.g. `"Close retire modal"`) | Minor |

**Remediation:** Add `useEffect` with `keydown` listener for `Escape`, implement focus trap (Tab cycling within the dialog), and store + restore `document.activeElement` on open/close. See #483.

---

### 2. Colour contrast — #533 (Medium)

**Pages:** All

| Element | Issue |
|---|---|
| `text-gray-400` on white backgrounds | Likely fails 4.5:1 for small text |
| `text-gray-500` labels on white | Borderline — requires manual check |
| Dark mode: `dark:text-gray-400` on `dark:bg-gray-900` | Requires measurement |

**Remediation:** Run pa11y or axe-core audit across all pages; replace failing tokens with higher-contrast equivalents. See `docs/COLOR_CONTRAST_AUDIT.md` and #533.

---

### 3. Admin page mobile layout — #541 (Medium)

**Page:** `apps/web/src/app/admin/page.tsx`

- Data tables lack horizontal scroll on small viewports.
- Action buttons overflow on screens < 375 px.

**Remediation:** Wrap tables in `overflow-x-auto`, use responsive button sizing. See #541.

---

### 4. RTL language support (Low)

- SolarProof supports `en`, `es`, `fr`, `de` — all LTR. No RTL support currently.
- If Arabic/Hebrew are added, `dir="rtl"` on `<html>` and logical CSS properties are required (see `docs/ACCESSIBILITY_LOCALIZATION.md`).

---

### 5. Skip navigation link (Low)

- No "Skip to main content" link is present.
- This is a WCAG 2.4.1 (bypass blocks) AA requirement for pages with repeated navigation.

**Remediation:** Add a visually-hidden-until-focused link as the first element in `layout.tsx`:

```tsx
<a
  href="#main-content"
  className="sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:z-50 focus:rounded focus:bg-white focus:px-3 focus:py-1 focus:text-sm focus:font-medium focus:shadow"
>
  Skip to main content
</a>
```

---

### 6. Focus visible styles (Low)

- All focusable elements use `focus:ring-2 focus:ring-yellow-400` (Tailwind).
- Verify that `focus-visible:` variants are used instead of `focus:` where pointer-based styles should not apply (browsers differ on this).

---

## Testing Checklist

Run before merging any frontend PR:

- [ ] `pnpm dlx axe-core` (or Lighthouse accessibility audit) — zero critical violations
- [ ] Keyboard-only navigation through the page — all actions reachable
- [ ] Screen reader test with NVDA (Windows) or VoiceOver (macOS/iOS)
- [ ] Responsive check at 375 px, 768 px, 1280 px viewports
- [ ] Colour contrast check with [WebAIM Contrast Checker](https://webaim.org/resources/contrastchecker/) for any new colour tokens

---

## Related Issues & Documents

| Reference | Topic |
|---|---|
| #480 | Accessible proof steps on verify page |
| #483 | Modal dismissal (Escape, focus trap, focus return) |
| #486 | Language selector keyboard support |
| #533 | Colour contrast audit |
| #541 | Admin page mobile layout |
| `docs/ACCESSIBILITY_LOCALIZATION.md` | Contribution guide for a11y & l10n |
| `docs/COLOR_CONTRAST_AUDIT.md` | Colour contrast remediation plan |
