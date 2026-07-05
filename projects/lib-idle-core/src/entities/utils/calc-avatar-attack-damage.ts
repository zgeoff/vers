import type { Avatar, SimulationContext } from '../../types';

// oxlint-disable-next-line typescript/prefer-readonly-parameter-types -- baseline(#236)
export function calcAvatarAttackDamage(avatar: Avatar, ctx: SimulationContext): number {
  if (!avatar.mainHandEquipment) {
    return 0;
  }

  return ctx.rng.getInt(avatar.mainHandEquipment.minDamage, avatar.mainHandEquipment.maxDamage);
}
