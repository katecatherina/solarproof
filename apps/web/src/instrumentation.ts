/**
 * OpenTelemetry instrumentation for SolarProof Next.js API.
 *
 * Next.js loads this file automatically when `experimental.instrumentationHook`
 * is enabled (Next.js 13.4+) or unconditionally in Next.js 15+.
 *
 * Traces are exported to an OTLP-compatible collector (Grafana Cloud,
 * Honeycomb, etc.) via OTEL_EXPORTER_OTLP_ENDPOINT.
 *
 * Key spans instrumented:
 *   - HTTP request lifecycle (via @opentelemetry/instrumentation-http)
 *   - Signature verification  → span: "ed25519.verify"
 *   - Stellar submission      → span: "stellar.anchor" / "stellar.mint"
 *   - Database queries        → span: "db.query" (via fetch instrumentation)
 *
 * Required env vars:
 *   OTEL_EXPORTER_OTLP_ENDPOINT  — e.g. https://otlp-gateway-prod-us-east-0.grafana.net/otlp
 *   OTEL_EXPORTER_OTLP_HEADERS   — e.g. Authorization=Basic <base64>
 *
 * Optional:
 *   OTEL_SERVICE_NAME            — defaults to "solarproof-api"
 *   OTEL_SERVICE_VERSION         — defaults to npm package version
 */

export async function register() {
  if (process.env.NEXT_RUNTIME !== 'nodejs') return

  const { NodeSDK } = await import('@opentelemetry/sdk-node')
  const { OTLPTraceExporter } = await import('@opentelemetry/exporter-trace-otlp-http')
  const { Resource } = await import('@opentelemetry/resources')
  const { SEMRESATTRS_SERVICE_NAME, SEMRESATTRS_SERVICE_VERSION } = await import('@opentelemetry/semantic-conventions')
  const { SimpleSpanProcessor } = await import('@opentelemetry/sdk-trace-node')
  const { HttpInstrumentation } = await import('@opentelemetry/instrumentation-http')
  const { FetchInstrumentation } = await import('@opentelemetry/instrumentation-fetch')

  const exporter = new OTLPTraceExporter()

  const sdk = new NodeSDK({
    resource: new Resource({
      [SEMRESATTRS_SERVICE_NAME]: process.env.OTEL_SERVICE_NAME ?? 'solarproof-api',
      [SEMRESATTRS_SERVICE_VERSION]: process.env.npm_package_version ?? '1.0.0',
    }),
    spanProcessor: new SimpleSpanProcessor(exporter) as never,
    instrumentations: [
      new HttpInstrumentation(),
      new FetchInstrumentation(),
    ],
  })

  sdk.start()

  // Start the BullMQ worker for async Stellar transaction processing
  const { startWorker } = await import(/* webpackIgnore: true */ '@/lib/queue')
  startWorker()

  // --- Metrics (export to OTLP if configured) ---------------------------------
  try {
    const { MeterProvider } = await import('@opentelemetry/sdk-metrics')
    const { OTLPMetricExporter } = await import('@opentelemetry/exporter-metrics-otlp-http')
    const { PeriodicExportingMetricReader } = await import('@opentelemetry/sdk-metrics')

    const otlpEndpoint = process.env.OTEL_EXPORTER_OTLP_METRICS_ENDPOINT ?? process.env.OTEL_EXPORTER_OTLP_ENDPOINT
    if (otlpEndpoint) {
      const exporter = new OTLPMetricExporter({ url: otlpEndpoint })
      const meterProvider = new MeterProvider()
      const reader = new PeriodicExportingMetricReader({ exporter, exportIntervalMillis: 10_000 })
      meterProvider.addMetricReader(reader)
      // Attach meter provider globally
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const api = await import('@opentelemetry/api')
      api.metrics.setGlobalMeterProvider(meterProvider)
    }
  } catch (err) {
    // Non-fatal — don't block startup if metrics packages are missing
    // eslint-disable-next-line no-console
    console.warn('Failed to initialize metrics exporter:', err)
  }
}
