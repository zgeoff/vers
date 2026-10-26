import { expect, test } from 'bun:test';
import { buildMockScenarioRecording } from './build-mock-scenario-recording';

test('it builds a default scenario recording', () => {
  expect(buildMockScenarioRecording()).toStrictEqual({
    calls: [],
    events: [],
    lockWaits: { acquiredAfterMs: [], byLock: {}, waits: 0 },
    name: 'steady-10',
    players: 10,
    playMs: 60_000,
    reconciliation: {
      activities: 0,
      avatarXPMismatches: 0,
      checkpoints: 0,
      held: 0,
      outcomes: {},
      runXPMismatches: 0,
      simulatedMs: 0,
      unverified: 0,
    },
    recording: { containers: [], pipeline: [], settlementAges: [] },
    refusals: [],
    settleMs: 2000,
  });
});

test('it applies overrides on top of the defaults', () => {
  const recording = buildMockScenarioRecording({
    players: 50,
    reconciliation: { held: 2 },
    recording: { settlementAges: [{ ageMs: 900, elapsedMs: 1000 }] },
  });

  expect(recording).toMatchObject({
    players: 50,
    reconciliation: { activities: 0, held: 2 },
    recording: { containers: [], settlementAges: [{ ageMs: 900, elapsedMs: 1000 }] },
  });
});
