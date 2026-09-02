import * as z from 'zod';
import { EquipmentWeaponSchema } from './equipment-weapon-schema';

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
