# Backlog: Public Verifier Audit Trail Export

**Issue:** #615  
**Status:** In Progress  
**Priority:** Medium

## Summary

Expose a public, no-auth CSV export endpoint so auditors and certificate buyers can download their own audit trail directly from the verify page — without needing an account or operator credentials.

## Background

`GET /api/audit-log` already exports CSV filtered by date range and operator ID, but it is intended for authenticated operators. There is no way for a third-party auditor to export the audit trail for a specific certificate they hold.

## Feature Description

Add `GET /api/audit-log/export` — a public endpoint filtered by `certificate_id` (required) plus optional `from`/`to` date range. The response is a CSV file the auditor can download locally or import into a spreadsheet.

### Endpoint

```
GET /api/audit-log/export?certificate_id=<id>[&from=ISO&to=ISO]
```

| Param | Required | Description |
|---|---|---|
| `certificate_id` | ✅ | Certificate (resource) ID to filter by |
| `from` | ❌ | ISO 8601 start date (default: 30 days ago) |
| `to` | ❌ | ISO 8601 end date (default: now) |

### Response

`200 text/csv` — rows from `audit_log` where `resource_id = certificate_id`, ordered by `created_at` ascending.  
`400` — if `certificate_id` is missing.

### UI hook

Add a "Download audit trail" button on `/verify?id=<certificate_id>` that calls this endpoint with the certificate ID pre-filled.

## Acceptance Criteria

- [ ] `GET /api/audit-log/export?certificate_id=X` returns CSV without authentication
- [ ] Missing `certificate_id` returns HTTP 400
- [ ] Optional `from`/`to` params narrow the date range
- [ ] CSV filename includes the certificate ID and date range
- [ ] Verify page exposes a download button that calls the endpoint

## Out of Scope

- Pagination (export is assumed to be bounded by date range)
- Auth-gated bulk export (covered by existing `/api/audit-log`)
