import * as z from 'zod';

/**
 * A combatant's attack stats, as the engine consumes them.
 */
export const AttackDataSchema = z.object({
  maxDamage: z.number(),
  minDamage: z.number(),
  speed: z.number(),
});

export type AttackData = z.infer<typeof AttackDataSchema>;
