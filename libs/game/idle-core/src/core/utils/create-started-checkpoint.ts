import type { ActivityStartedCheckpoint, SimulationContext } from '../../types';
import { ActivityCheckpointType } from '../../types';

/**
 * `Started` consumes nothing from the seed chain, so `nextSeed` equals `seed` verbatim.
 */
export function createStartedCheckpoint(ctx: SimulationContext): ActivityStartedCheckpoint {
  const seed = ctx.rng.getState();

  return {
    nextSeed: seed,
    rewards: { xp: 0 },
    rewardSlots: [],
    seed,
    time: 0,
    type: ActivityCheckpointType.Started,
  };
}
