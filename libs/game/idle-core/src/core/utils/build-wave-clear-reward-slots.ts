import invariant from 'tiny-invariant';
import type { RewardSlotContext, Wave } from '../../types';

export function buildWaveClearRewardSlots(
  wave: Wave,
  difficulty: number,
): ReadonlyArray<RewardSlotContext> {
  invariant(Number.isInteger(difficulty) && difficulty >= 1, 'nodeTier must be a positive integer');

  return wave.enemies.map(() => ({ nodeTier: difficulty }));
}
