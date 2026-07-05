import type { ActivityStartedCheckpoint, SimulationContext } from '../../types';
import { ActivityCheckpointType } from '../../types';
import { hashObject } from '../../utils/hash-object';

// oxlint-disable-next-line typescript/prefer-readonly-parameter-types -- baseline(#236)
export function createStartedCheckpoint(ctx: SimulationContext): ActivityStartedCheckpoint {
  const result: Omit<ActivityStartedCheckpoint, 'hash'> = {
    seed: ctx.rng.seed,
    time: 0,
    type: ActivityCheckpointType.Started,
  };

  const hash = hashObject(ctx.hasher, result);

  return { ...result, hash };
}
