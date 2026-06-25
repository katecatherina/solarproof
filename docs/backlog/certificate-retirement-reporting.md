---
title: Certificate Retirement Reporting Backlog
status: draft
---

## Overview

Add backend and reporting support so retired certificates can be queried and exported for audit and regulatory purposes.

## Scope

- Add API endpoints to query retired certificates by date range, meter, and owner.
- Add background job to aggregate retirement metrics and export CSV reports.
- Document retention policy and access controls.

## Suggested Implementation Steps

1. Add `retired_at` and `retirement_reason` metadata to certificates table if not present.
2. Implement `GET /api/certificates?status=retired` with filters and pagination.
3. Add scheduled job to aggregate and store CSV reports in object storage; surface them in the admin UI.
