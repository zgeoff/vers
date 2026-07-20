import * as z from 'zod';

/**
 * Environment the keys service needs beyond the base service env: the root key material avatar
 * roll keys are derived from.
 */
export const envShape = {
  ROLL_KEY_ROOTS: z
    .string()
    .min(1)
    .describe(
      'JSON payload of per-population roll-key roots: each population carries its current key version and every root version still derived against',
    ),
};
