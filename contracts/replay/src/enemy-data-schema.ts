import * as z from 'zod';
import { AttackDataSchema } from './attack-data-schema';

/**
 * One enemy in an activity's roster, as the engine consumes it.
 */
export const EnemyDataSchema = z.object({
  level: z.number(),
  life: z.number(),
  name: z.string(),
  primaryAttack: AttackDataSchema,
  xp: z.number(),
});

export type EnemyData = z.infer<typeof EnemyDataSchema>;
