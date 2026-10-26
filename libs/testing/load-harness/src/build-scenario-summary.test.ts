import { expect, test } from 'bun:test';
import { buildScenarioSummary } from './build-scenario-summary';
import { buildMockScenarioRecording } from './test-utils/build-mock-scenario-recording';

test('it takes the settlement age percentiles over every verified checkpoint', () => {
  const recording = buildMockScenarioRecording({
    recording: {
      settlementAges: [1000, 2000, 3000, 4000, 20_000].map((ageMs) => ({ ageMs, elapsedMs: 0 })),
    },
  });

  expect(buildScenarioSummary(recording).settlementAgeMs).toStrictEqual({
    count: 5,
    max: 20_000,
    p50: 3000,
    p95: 20_000,
    p99: 20_000,
  });
});

test('it reads the peak verified rate over a full minute of samples', () => {
  const recording = buildMockScenarioRecording({
    recording: {
      pipeline: [0, 30_000, 60_000, 90_000].map((elapsedMs, index) => ({
        appended: 0,
        backedOff: 0,
        elapsedMs,
        held: 0,
        lockWaiters: 0,
        longestTransactionMs: 0,
        verified: [0, 100, 150, 400][index] ?? 0,
      })),
    },
  });

  expect(buildScenarioSummary(recording).workload.peakVerifiedPerMinute).toBe(300);
});

test('it counts failed calls by status and summarises each procedure', () => {
  const recording = buildMockScenarioRecording({
    calls: [
      { durationMs: 10, procedure: 'trackActivityProgress', status: 200 },
      { durationMs: 30, procedure: 'trackActivityProgress', status: 503 },
      { durationMs: 20, procedure: 'advanceActivity', status: 200 },
    ],
  });

  const summary = buildScenarioSummary(recording);

  expect(summary.delivery.failedByStatus).toStrictEqual({ 'HTTP 503': 1 });

  expect(summary.delivery.procedures).toStrictEqual([
    { calls: 1, failures: 0, p50Ms: 20, p95Ms: 20, procedure: 'advanceActivity' },
    { calls: 2, failures: 1, p50Ms: 10, p95Ms: 30, procedure: 'trackActivityProgress' },
  ]);
});

test('it counts a call whose fetch threw as no response, by its socket error', () => {
  const recording = buildMockScenarioRecording({
    calls: [
      { durationMs: 0, failure: 'ECONNRESET', procedure: 'stopActivity', status: 0 },
      { durationMs: 0, failure: 'ECONNRESET', procedure: 'trackActivityProgress', status: 0 },
      { durationMs: 0, failure: 'ECONNREFUSED', procedure: 'stopActivity', status: 0 },
    ],
  });

  expect(buildScenarioSummary(recording).delivery.failedByStatus).toStrictEqual({
    'no response (ECONNREFUSED)': 1,
    'no response (ECONNRESET)': 2,
  });
});

test('it orders containers by mean CPU against their own limit and keeps each one peak memory', () => {
  const recording = buildMockScenarioRecording({
    cpuLimits: { 'vers-load-app-web-1': 0.25, 'vers-load-service-replay-1': 2 },
    recording: {
      containers: [
        { container: 'vers-load-app-web-1', cpuPercent: 10, elapsedMs: 0, memoryBytes: 100 },
        { container: 'vers-load-service-replay-1', cpuPercent: 80, elapsedMs: 0, memoryBytes: 50 },
        { container: 'vers-load-app-web-1', cpuPercent: 30, elapsedMs: 1000, memoryBytes: 300 },
      ],
    },
  });

  expect(buildScenarioSummary(recording).resources).toStrictEqual([
    {
      container: 'vers-load-app-web-1',
      cpuLimitCores: 0.25,
      cpuMeanPercent: 20,
      cpuMeanShareOfLimit: 0.8,
      cpuP95Percent: 30,
      memoryPeakBytes: 300,
    },
    {
      container: 'vers-load-service-replay-1',
      cpuLimitCores: 2,
      cpuMeanPercent: 80,
      cpuMeanShareOfLimit: 0.4,
      cpuP95Percent: 80,
      memoryPeakBytes: 50,
    },
  ]);
});

test('it rates a container with no CPU limit against one core', () => {
  const recording = buildMockScenarioRecording({
    recording: {
      containers: [
        { container: 'vers-load-app-web-1', cpuPercent: 50, elapsedMs: 0, memoryBytes: 100 },
      ],
    },
  });

  expect(buildScenarioSummary(recording).resources[0]?.cpuMeanShareOfLimit).toBe(0.5);
});

test('it measures recovery from the outage end to the first sample back at the pre-outage backlog', () => {
  const recording = buildMockScenarioRecording({
    outage: { endedMs: 3000, service: 'service-keys', startedMs: 2000 },
    recording: {
      pipeline: [
        [0, 5],
        [1000, 5],
        [2000, 30],
        [3000, 60],
        [4000, 40],
        [5000, 4],
      ].map(([elapsedMs = 0, backlog = 0]) => ({
        appended: backlog,
        backedOff: 0,
        elapsedMs,
        held: 0,
        lockWaiters: 0,
        longestTransactionMs: 0,
        verified: 0,
      })),
    },
  });

  expect(buildScenarioSummary(recording).recoveryMs).toBe(2000);
});

test('it reports no recovery time for a scenario without an outage', () => {
  expect(buildScenarioSummary(buildMockScenarioRecording()).recoveryMs).toBeUndefined();
});
