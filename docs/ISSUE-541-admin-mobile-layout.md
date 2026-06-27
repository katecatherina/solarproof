# Issue #541 — Improve admin page mobile layout and action affordances

Summary of proposed improvements and design notes to make the admin page more usable on mobile.

## Problems

- Action buttons are too small and closely spaced on narrow screens.
- Critical actions (approve/reject) are not clearly differentiated on mobile.
- Tables are not responsive and require horizontal scrolling.

## Proposed Changes

- Convert key admin actions to large, full-width touch targets on small screens.
- Replace dense tables with stacked card layout at narrow breakpoints.
- Add confirm dialogs with clear primary/secondary button styling for destructive actions.

## Acceptance Criteria

- Buttons meet touch target guidance (44x44pt) on mobile.
- Admin workflows can be completed without horizontal scrolling.
