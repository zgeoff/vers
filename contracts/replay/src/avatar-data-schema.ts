import * as z from 'zod';
import { EquipmentWeaponSchema } from './equipment-weapon-schema';

/**
 * Wire shape of the engine's `AvatarData` — the avatar snapshot `runSimulation` replays against.
 */
export const AvatarDataSchema = z.object({
  id: z.string(),
  level: z.number(),
  life: z.number(),
  name: z.string(),
  paperdoll: z.object({
    mainHand: EquipmentWeaponSchema.nullable(),
  }),
  xp: z.number(),
});

export type AvatarData = z.infer<typeof AvatarDataSchema>;
