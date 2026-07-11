import type { ActivityCompletedCheckpoint, SimulationContext } from '../../types';
import { ActivityCheckpointType } from '../../types';
import { hashObject } from '../../utils/hash-object';

export function createCompletedCheckpoint(
  elapsed: number,
  ctx: SimulationContext,
): ActivityCompletedCheckpoint {
  const result: Omit<ActivityCompletedCheckpoint, 'hash'> = {
    nextSeed: ctx.rng.generateNewSeed(),
    time: elapsed,
    type: ActivityCheckpointType.Completed,
  };

  const hash = hashObject(ctx.hasher, result);

  return { ...result, hash };
}
