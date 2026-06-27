# Issue #611 — Public verification kiosk mode: User story backlog

This file captures user stories and acceptance criteria for a public verification kiosk mode.

## Goal
Allow members of the public to verify credentials or readings at a public kiosk with minimal friction and strong privacy guarantees.

## User Stories

- As a public user, I can walk up to a verification kiosk and scan a QR code to see a read-only verification page.
- As a kiosk operator, I can switch the kiosk into 'demo' mode where sample data is shown without exposing real user data.
- As a user, I can request a printed receipt or short code to take away as proof of verification.
- As a system admin, I can configure an inactivity timeout and automatic screen lock for the kiosk.

## Acceptance Criteria

- The kiosk presents only read-only verification information; no personal data entry is required.
- Kiosk session automatically clears after inactivity.
- Demo mode uses sanitized sample data.

## Notes
- Consider accessibility (large font, high contrast) and touch-friendly UI for public use.
