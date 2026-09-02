import * as z from 'zod';

export const AttackDataSchema = z.object({
  maxDamage: z.number(),
  minDamage: z.number(),
  speed: z.number(),
});

export type AttackData = z.infer<typeof AttackDataSchema>;
