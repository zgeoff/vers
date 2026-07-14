import * as z from 'zod';

/**
 * A weapon equipped in an avatar's paperdoll.
 */
export const EquipmentWeaponSchema = z.object({
  id: z.string(),
  maxDamage: z.number(),
  minDamage: z.number(),
  name: z.string(),
  speed: z.number(),
});

export type EquipmentWeapon = z.infer<typeof EquipmentWeaponSchema>;
