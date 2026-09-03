import type { ActivityCheckpoint, ActivityInput, AvatarData, Simulation } from '@vers/idle-core';
import { ActivityCheckpointType, SIMULATION_TIMESTEP_MS, createSimulation } from '@vers/idle-core';
import invariant from 'tiny-invariant';

interface RunReconstructionOptions {
  readonly appendedHead: number;
  readonly activity: ActivityInput;
  readonly avatar: AvatarData;
  readonly timestepMs?: number;
}

type RunReconstructionResult =
  | { readonly divergence: true }
  | { readonly lastCheckpoint: ActivityCheckpoint; readonly simulation: Simulation };

export function runReconstruction(
  options: Readonly<RunReconstructionOptions>,
): RunReconstructionResult {
  invariant(
    options.appendedHead >= 1,
    'reconstruction requires at least one confirmed checkpoint to target',
  );

  const timestepMs = options.timestepMs ?? SIMULATION_TIMESTEP_MS;

  invariant(
    Number.isFinite(timestepMs) && timestepMs > 0,
    'reconstruction requires a positive timestep to make forward progress',
  );

  const simulation = createSimulation();

  simulation.startActivity(options.avatar, options.activity);

  let count = 0;
  let lastCheckpoint: ActivityCheckpoint | undefined;

  while (count < options.appendedHead) {
    const checkpoint = simulation.run(timestepMs);

    if (checkpoint === null) {
      continue;
    }

    lastCheckpoint = checkpoint;
    count += 1;

    const isTerminal =
      checkpoint.type === ActivityCheckpointType.Completed ||
      checkpoint.type === ActivityCheckpointType.Failed;

    if (isTerminal && count < options.appendedHead) {
      return { divergence: true };
    }
  }

  invariant(lastCheckpoint !== undefined, 'a reconstruction that reached its target emitted one');

  return { lastCheckpoint, simulation };
}
