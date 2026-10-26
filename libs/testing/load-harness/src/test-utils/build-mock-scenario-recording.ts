import type { Reconciliation, SamplerRecording, ScenarioRecording } from '../types';

interface ScenarioRecordingOverrides extends Partial<
  Omit<ScenarioRecording, 'reconciliation' | 'recording'>
> {
  readonly reconciliation?: Partial<Reconciliation>;
  readonly recording?: Partial<SamplerRecording>;
}

// fixed defaults throughout: a recording feeds the report, whose output tests pin as golden values
export function buildMockScenarioRecording(
  overrides: Readonly<ScenarioRecordingOverrides> = {},
): ScenarioRecording {
  return {
    calls: [],
    cpuLimits: {},
    events: [],
    exits: [],
    lockWaits: { acquiredAfterMs: [], byLock: {}, waits: 0 },
    name: 'steady-10',
    players: 10,
    playMs: 60_000,
    refusals: [],
    settleMs: 2000,
    ...overrides,
    reconciliation: {
      activities: 0,
      avatarXPMismatches: 0,
      checkpoints: 0,
      held: 0,
      outcomes: {},
      runXPMismatches: 0,
      simulatedMs: 0,
      unverified: 0,
      ...overrides.reconciliation,
    },
    recording: {
      containers: [],
      pipeline: [],
      settlementAges: [],
      ...overrides.recording,
    },
  };
}
