// @ts-check
/** @type {import('@stryker-mutator/core').PartialStrykerOptions} */
const config = {
  testRunner: 'vitest',
  vitest: { configFile: 'vitest.config.ts' },
  mutate: [
    'src/app/api/verify/route.ts',
    'src/app/api/audit-log/route.ts',
  ],
  thresholds: { high: 70, low: 50, break: 40 },
  reporters: ['html', 'progress', 'json'],
  htmlReporter: { fileName: 'reports/mutation/index.html' },
  jsonReporter: { fileName: 'reports/mutation/report.json' },
  coverageAnalysis: 'perTest',
  timeoutMS: 30000,
};
export default config;
