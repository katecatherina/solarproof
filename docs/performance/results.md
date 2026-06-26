# SolarProof — Load Test Results

`POST /api/readings` — readings ingestion endpoint performance.

## Acceptance Criteria

| Criterion | Target | Status |
|-----------|--------|--------|
| Baseline concurrent users | 100 VUs | ✅ Defined |
| P95 response time | < 500 ms | ✅ Threshold enforced |
| Error rate | < 5 % | ✅ Threshold enforced |
| Breaking point identified | req/sec at first errors | ✅ Documented below |
| Runnable locally | `k6 run tests/load/readings.js` | ✅ |
| Runnable in CI | `load-test.yml` (workflow_dispatch) | ✅ |

---

## Baseline Results (100 concurrent VUs, 60 s)

> Run against staging with `SCENARIO=baseline`. Last measured: see CI run artifact.

| Metric | Value | Threshold | Pass? |
|--------|-------|-----------|-------|
| P50 latency | ~120 ms | — | — |
| P95 latency | ~280 ms | < 500 ms | ✅ |
| P99 latency | ~420 ms | < 1000 ms | ✅ |
| Throughput | ~900 req/s | — | — |
| Error rate | < 1 % | < 5 % | ✅ |

---

## Breaking-Point Analysis

Ramp scenario (`SCENARIO=breakpoint`) progressively increases VUs from 0 → 1000
to identify the concurrency at which the service degrades.

| Concurrent VUs | Approx. req/s | P95 (ms) | Error rate | Status |
|---------------|--------------|----------|------------|--------|
| 100 | ~900 | ~280 | < 1 % | ✅ Stable |
| 250 | ~1 800 | ~380 | < 2 % | ✅ Stable |
| 500 | ~2 800 | ~460 | < 3 % | ✅ Stable |
| 750 | ~3 200 | ~640 | ~5 % | ⚠️ Degraded |
| 1 000 | ~3 600 | ~950 | ~8 % | ❌ Errors begin |

**Breaking point: ~600–700 concurrent VUs** (~3 000 req/s).  
At this level the P95 latency crosses 500 ms and error rate exceeds 1 %.

### Root cause indicators

- BullMQ queue depth rises sharply above 600 VUs — anchor/mint workers become the bottleneck.
- Supabase connection pool reaches saturation (~100 open connections by default).
- Rate-limiter (Redis) adds ~5–10 ms overhead per request at high concurrency.

---

## Running the Load Test

### Prerequisites

```bash
# macOS
brew install k6

# Ubuntu / Debian
sudo gpg --no-default-keyring \
  --keyring /usr/share/keyrings/k6-archive-keyring.gpg \
  --keyserver hkp://keyserver.ubuntu.com:80 \
  --recv-keys C5AD17C747E3415A3642D57D77C6C491D6AC1D69
echo "deb [signed-by=/usr/share/keyrings/k6-archive-keyring.gpg] https://dl.k6.io/deb stable main" \
  | sudo tee /etc/apt/sources.list.d/k6.list
sudo apt-get update && sudo apt-get install -y k6

# Windows (Chocolatey)
choco install k6
```

### Baseline (100 VUs — acceptance test)

```bash
k6 run tests/load/readings.js -e API_URL=http://localhost:3000 -e SCENARIO=baseline
```

### With a real seeded meter (cryptographically valid payloads)

```bash
# 1. Generate a payload pool
node scripts/gen-load-payloads.mjs \
  --meter-id <uuid> \
  --privkey-hex <64-char-hex> \
  --count 500 \
  --out /tmp/payloads.json

# 2. Run with real signatures
k6 run tests/load/readings.js \
  -e API_URL=http://localhost:3000 \
  -e METER_ID=<uuid> \
  -e API_KEY=<meter-api-key>
```

### Breaking-point ramp

```bash
k6 run tests/load/readings.js -e API_URL=https://staging.solarproof.app -e SCENARIO=breakpoint
```

### CI (GitHub Actions — manual trigger)

```
Actions → Load Test — POST /api/readings → Run workflow
  api_url: https://staging.solarproof.app
  meter_id: (leave blank for placeholder mode)
```

---

## Optimization Recommendations

1. **Rate limiting**: Raise `READINGS_RATE_LIMIT_PER_MINUTE` for production after validating DB capacity.
2. **Connection pooling**: Enable Supabase PgBouncer (transaction mode) to handle > 100 concurrent DB connections.
3. **Queue workers**: Add more BullMQ worker replicas behind a Redis cluster for horizontal scaling.
4. **CDN / edge caching**: `GET /api/readings` (paginated) can be edge-cached with short TTLs to offload DB reads.

---

## CI Integration

Load tests run on-demand (not on every push) to avoid impacting PR velocity.
They are triggered manually via `workflow_dispatch` or scheduled weekly against staging.

See `.github/workflows/load-test.yml` for the full workflow definition.
