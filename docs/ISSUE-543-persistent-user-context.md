# Issue #543 — Persistent user context for cooperative pages

Proposed approach for adding persistent user context across cooperative pages.

## Motivation

Some cooperative pages benefit from remembering the user's last-selected organization, role, or filter state across sessions to improve workflow continuity.

## Proposal

- Store minimal user context in an encrypted, signed cookie or in localStorage with explicit opt-in.
- Provide UI affordance to clear saved context.
- Ensure context storage respects privacy and data minimization principles.

## Acceptance Criteria

- Users can opt in to persist selection state across visits.
- Admins can clear persisted contexts from the server if needed.
