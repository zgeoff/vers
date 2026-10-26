import { expect, test } from 'bun:test';
import { buildCapacityVerdict } from './build-capacity-verdict';
import { buildScenarioSummary } from './build-scenario-summary';
import { buildMockScenarioRecording } from './test-utils/build-mock-scenario-recording';

test('it supports the largest step that met the target and names its busiest container', () => {
  const steps = [
    buildMockScenarioRecording({
      players: 25,
      recording: {
        containers: [
          { container: 'vers-load-app-web-1', cpuPercent: 20, elapsedMs: 0, memoryBytes: 1 },
        ],
        settlementAges: [{ ageMs: 5000, elapsedMs: 0 }],
      },
    }),
    buildMockScenarioRecording({
      players: 50,
      recording: {
        containers: [
          { container: 'vers-load-service-replay-1', cpuPercent: 70, elapsedMs: 0, memoryBytes: 1 },
        ],
        settlementAges: [{ ageMs: 9000, elapsedMs: 0 }],
      },
    }),
    buildMockScenarioRecording({
      players: 100,
      recording: {
        containers: [
          {
            container: 'vers-load-service-replay-1',
            cpuPercent: 100,
            elapsedMs: 0,
            memoryBytes: 1,
          },
        ],
        settlementAges: [{ ageMs: 45_000, elapsedMs: 0 }],
      },
    }),
  ].map((recording) => buildScenarioSummary(recording));

  const verdict = buildCapacityVerdict(steps, 30_000);

  expect(verdict.supportedPlayers).toBe(50);
  expect(verdict.limitingContainer).toBe('vers-load-service-replay-1');
});

test('it supports no step that failed a delivery, whatever its settlement age', () => {
  const steps = [
    buildMockScenarioRecording({
      calls: [{ durationMs: 10, procedure: 'trackActivityProgress', status: 503 }],
      players: 25,
      recording: { settlementAges: [{ ageMs: 1000, elapsedMs: 0 }] },
    }),
  ].map((recording) => buildScenarioSummary(recording));

  expect(buildCapacityVerdict(steps, 30_000).supportedPlayers).toBeUndefined();
});

test('it names the container that exited in the first step that missed the target', () => {
  const steps = [
    buildMockScenarioRecording({
      players: 25,
      recording: { settlementAges: [{ ageMs: 1000, elapsedMs: 0 }] },
    }),
    buildMockScenarioRecording({
      exits: [
        { container: 'vers-load-app-web-1', elapsedMs: 90_000, exitCode: 139, oomKilled: false },
      ],
      players: 50,
      recording: {
        containers: [
          { container: 'vers-load-postgres-1', cpuPercent: 90, elapsedMs: 0, memoryBytes: 1 },
        ],
        settlementAges: [{ ageMs: 1000, elapsedMs: 0 }],
      },
    }),
  ].map((recording) => buildScenarioSummary(recording));

  const verdict = buildCapacityVerdict(steps, 30_000);

  expect(verdict.supportedPlayers).toBe(25);
  expect(verdict.limitingContainer).toBe('vers-load-app-web-1');
  expect(verdict.limitingExit?.exitCode).toBe(139);
});

test('it supports no step that left checkpoints unproved', () => {
  const steps = [
    buildMockScenarioRecording({ players: 25, reconciliation: { unverified: 12 } }),
  ].map((recording) => buildScenarioSummary(recording));

  expect(buildCapacityVerdict(steps, 30_000).supportedPlayers).toBeUndefined();
});

test.each([
  ['a run', { runXPMismatches: 1 }],
  ['an avatar', { avatarXPMismatches: 1 }],
])('it supports no step that paid %s other XP than its stream earned', (_label, reconciliation) => {
  const steps = [buildMockScenarioRecording({ players: 25, reconciliation })].map((recording) =>
    buildScenarioSummary(recording),
  );

  expect(buildCapacityVerdict(steps, 30_000).supportedPlayers).toBeUndefined();
});

test('it rates simulated hours against the wall time of play', () => {
  const steps = [
    buildMockScenarioRecording({ playMs: 1_800_000, reconciliation: { simulatedMs: 36_000_000 } }),
  ].map((recording) => buildScenarioSummary(recording));

  expect(buildCapacityVerdict(steps, 30_000).steps[0]?.simulatedHoursPerHour).toBe(20);
});
