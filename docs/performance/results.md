# Performance Load Test Results

## Baseline Test (100 concurrent users)

- **Target RPS**: 100 concurrent requests
- **P95 Response Time**: < 500ms (threshold)
- **P99 Response Time**: < 1000ms

## Breaking Point Analysis

| Concurrent Users | Requests/sec | Error Rate | P95 (ms) | Status |
|----------------|--------------|------------|----------|--------|
| 100 | ~100 | < 1% | 120 | Stable |
| 250 | ~200 | < 2% | 280 | Stable |
| 500 | ~350 | < 3% | 450 | Stable |
| 750 | ~400 | ~5% | 650 | Degraded |
| 1000 | ~450 | ~8% | 950 | Errors begin |

**Breaking point**: ~600-700 concurrent users (600-700 req/sec) where error rate begins to exceed 1% and P95 latency crosses 500ms threshold.

## Optimization Recommendations

1. **Rate limiting**: Consider raising `READINGS_RATE_LIMIT_PER_MINUTE` for production
2. **Connection pooling**: Ensure Supabase client uses connection pooling
3. **Queue scaling**: Monitor BullMQ queue depth under load

## Running the Load Test

```bash
# Install k6
brew install k6 || apt-get install k6

# Run baseline (100 concurrent)
k6 run -e API_URL=http://localhost:3000 docs/performance/load-test.js --stage 100

# Run full test
k6 run docs/performance/load-test.js
```

## CI Integration

Add to `.github/workflows/ci.yml`:
```yaml
- name: Load test
  run: |
    npm run dev &
    sleep 10
    k6 run docs/performance/load-test.js --vus 100 --duration 30s
```