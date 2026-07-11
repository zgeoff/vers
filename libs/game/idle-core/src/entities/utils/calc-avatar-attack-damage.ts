import type { Avatar, SimulationContext } from '../../types';

export function calcAvatarAttackDamage(avatar: Avatar, ctx: SimulationContext): number {
  if (!avatar.mainHandEquipment) {
    return 0;
  }

  return ctx.rng.getInt(avatar.mainHandEquipment.minDamage, avatar.mainHandEquipment.maxDamage);
}
