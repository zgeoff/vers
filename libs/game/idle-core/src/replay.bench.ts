import { buildStateFromSeed } from '@vers/game-utils';
import type { EncounterContent } from '@vers/game-utils';
import { bench, run } from 'mitata';
import { buildSimulationInput } from './core/build-simulation-input';
import type { SimulationInputSource } from './core/build-simulation-input';
import { createSimulation } from './core/create-simulation';
import { createSimulationDriver } from './core/create-simulation-driver';
import { SIMULATION_TIMESTEP_MS } from './core/simulation-timestep-ms';
import { ActivityFailureAction } from './types';
import { isCompletedCheckpoint } from './utils/is-completed-checkpoint';
import { isFailedCheckpoint } from './utils/is-failed-checkpoint';

/**
 * Macro benchmarks for the two engine consumers: the listener-free driver every replay path runs
 * (verifier, reconstruction, fast-forward) and the live worker loop with an `updated` listener
 * attached. Run `bun run bench` from this package on an idle machine and paste before/after
 * numbers into any PR that touches the tick path. One simulated hour is 72,000 engine ticks.
 */

const SIMULATED_HOUR_MS = 3_600_000;

const SOURCE: SimulationInputSource = {
  avatarID: 'avatar-bench',
  buildSnapshot: { level: 5, xp: 0 },
  contentVersion: '1',
  encounterNode: { difficulty: 3 },
  id: 'activity-bench',
  seed: buildStateFromSeed(3_047_525_658),
};

const CONTENT: EncounterContent = {
  contentVersion: '1',
  archetypes: [
    {
      id: 'placeholder-brawler',
      name: 'World Map Enemy',
      baseLevel: 1,
      baseLife: 30,
      baseXP: 10,
      attackMin: 1,
      attackMax: 3,
      attackSpeed: 0.5,
    },
  ],
  pools: [{ id: 'default', entries: [{ archetypeID: 'placeholder-brawler', weight: 1 }] }],
  tuning: {
    waveCountMin: 3,
    waveCountMax: 6,
    waveSizeMin: 3,
    waveSizeMax: 6,
    difficultyScalingFactor: 1,
  },
};

bench('replay driver · 1 simulated hour', async () => {
  const input = buildSimulationInput(CONTENT, SOURCE, {
    failureAction: ActivityFailureAction.Retry,
  });

  const driver = createSimulationDriver(input.activity, input.avatar);

  await driver.advanceToDuration(SIMULATED_HOUR_MS);
});

bench('live loop with updated listener · 1 simulated hour', () => {
  const input = buildSimulationInput(CONTENT, SOURCE, {
    failureAction: ActivityFailureAction.Retry,
  });

  const simulation = createSimulation();

  simulation.addEventListener('updated', () => {});
  simulation.startActivity(input.avatar, input.activity);

  while (simulation.elapsed < SIMULATED_HOUR_MS) {
    const checkpoint = simulation.run(SIMULATION_TIMESTEP_MS);

    if (checkpoint && (isFailedCheckpoint(checkpoint) || isCompletedCheckpoint(checkpoint))) {
      simulation.restartActivity();
    }
  }
});

await run();
