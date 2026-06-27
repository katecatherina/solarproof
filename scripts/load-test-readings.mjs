// k6 load test for POST /api/readings — Issue #525
// Run: k6 run --env BASE_URL=http://localhost:3000 scripts/load-test-readings.mjs
// Run a specific scenario: k6 run --env BASE_URL=... --env SCENARIO=smoke scripts/load-test-readings.mjs

import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate, Trend } from 'k6/metrics';

const BASE_URL = __ENV.BASE_URL || 'http://localhost:3000';

const errorRate = new Rate('error_rate');
const p95Latency = new Trend('p95_latency', true);

export const options = {
  scenarios: {
    smoke: {
      executor: 'constant-vus',
      vus: 1,
      duration: '30s',
      tags: { scenario: 'smoke' },
    },
    load: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: [
        { duration: '1m', target: 50 },
        { duration: '3m', target: 50 },
        { duration: '1m', target: 0 },
      ],
      tags: { scenario: 'load' },
    },
    stress: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: [
        { duration: '2m', target: 200 },
        { duration: '30s', target: 0 },
      ],
      tags: { scenario: 'stress' },
    },
  },
  thresholds: {
    http_req_duration: ['p(95)<2000'],
    // error_rate threshold applies to smoke only via tag filtering
    'error_rate{scenario:smoke}': ['rate<0.1'],
  },
};

function uuid() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
  });
}

export default function () {
  const payload = JSON.stringify({
    meter_id: uuid(),
    kwh: Math.random() * 99 + 1,
    timestamp: new Date().toISOString(),
    signature_hex: '0'.repeat(128),
  });

  const res = http.post(`${BASE_URL}/api/readings`, payload, {
    headers: { 'Content-Type': 'application/json' },
  });

  const ok = check(res, {
    'status not 5xx': (r) => r.status < 500,
    'response time < 2s': (r) => r.timings.duration < 2000,
  });

  errorRate.add(!ok);
  p95Latency.add(res.timings.duration);

  sleep(0.1);
}
