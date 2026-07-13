import type { ActivityRewards, ActivityStartedCheckpoint, SimulationContext } from '../../types';
import { ActivityCheckpointType } from '../../types';

/**
 * `Started` consumes nothing from the seed chain, so `nextSeed` equals `seed` verbatim.
 */
export function createStartedCheckpoint(ctx: SimulationContext): ActivityStartedCheckpoint {
  const seed = ctx.rng.getState();
  const rewards: ActivityRewards = { xp: 0 };

  return { nextSeed: seed, rewards, seed, time: 0, type: ActivityCheckpointType.Started };
}
