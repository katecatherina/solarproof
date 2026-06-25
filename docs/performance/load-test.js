import http from 'k6/http'
import { check, sleep, group } from 'k6'
import { randomUUID } from 'k6/crypto'
import { Rate } from 'k6/metrics'

const errorRate = new Rate('errors')
const BASE_URL = __ENV.API_URL || 'http://localhost:3000'

export const options = {
  stages: [
    { duration: '30s', target: 10 },
    { duration: '1m', target: 50 },
    { duration: '1m', target: 100 },
    { duration: '2m', target: 100 },
    { duration: '1m', target: 150 },
    { duration: '1m', target: 200 },
    { duration: '1m', target: 300 },
    { duration: '1m', target: 400 },
    { duration: '1m', target: 500 },
    { duration: '2m', target: 500 },
    { duration: '1m', target: 750 },
    { duration: '1m', target: 1000 },
    { duration: '2m', target: 0 },
  ],
  thresholds: {
    http_req_duration: ['p(95)<500', 'p(99)<1000'],
    errors: ['rate<0.01'],
  },
}

function generateReading() {
  const meterId = __ENV.METER_ID || '00000000-0000-0000-0000-000000000000'
  const kwh = Math.random() * 100 + 0.1
  const timestamp = Math.floor(Date.now() / 1000)
  const signature = 'a'.repeat(128)
  const nonce = randomUUID().substring(0, 32)

  return {
    meter_id: meterId,
    kwh,
    timestamp,
    signature_hex: signature,
    nonce,
  }
}

export default function () {
  group('readings_api', () => {
    const reading = generateReading()
    const params = {
      headers: {
        'Content-Type': 'application/json',
        'Idempotency-Key': randomUUID(),
      },
      timeout: '10s',
    }

    const res = http.post(`${BASE_URL}/api/readings`, JSON.stringify(reading), params)

    const success = check(res, {
      'status is 202 or 400 or 401': (r) => [202, 400, 401, 404, 429].includes(r.status),
      'response time < 500ms': (r) => r.timings.duration < 500,
    })

    errorRate.add(!success)

    if (res.status === 202) {
      check(res, {
        'has reading_id': (r) => JSON.parse(r.body)?.reading_id !== undefined,
        'has job_id': (r) => JSON.parse(r.body)?.job_id !== undefined,
      })
    }

    sleep(0.1)
  })
}