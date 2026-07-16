import type { ActivityCheckpoint, ActivityInput, AvatarData, Simulation } from '@vers/idle-core';
import { ActivityCheckpointType, SIMULATION_TIMESTEP_MS, createSimulation } from '@vers/idle-core';
import invariant from 'tiny-invariant';

interface RunReconstructionOptions {
  /**
   * The confirmed checkpoint count to reconstruct up to. Callers only invoke reconstruction once
   * this is at least 1 — an appendedHead of 0 has no confirmed tail to replay and attaches
   * directly from the row's own start fields instead.
   */
  readonly appendedHead: number;
  readonly activity: ActivityInput;
  readonly avatar: AvatarData;
  readonly timestepMs?: number;
}

type RunReconstructionResult =
  | { readonly divergence: true }
  | { readonly lastCheckpoint: ActivityCheckpoint; readonly simulation: Simulation };

/**
 * Rebuilds a live simulation to the exact point the server has confirmed, by ticking a fresh
 * engine instance from the activity's own seed rather than trusting any client-persisted state —
 * the worker restart this resumes from has none. The returned simulation is left running at that
 * point, ready for the caller to keep ticking forward into unconfirmed territory. A local engine
 * that reaches its terminal checkpoint before matching the confirmed count can never reproduce the
 * rest of the server's stream, so that's reported as a divergence rather than a result to attach.
 */
export async function runReconstruction(
  options: Readonly<RunReconstructionOptions>,
): Promise<RunReconstructionResult> {
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
    const checkpoint = await simulation.run(timestepMs);

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
