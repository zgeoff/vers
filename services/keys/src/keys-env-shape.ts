import * as z from 'zod';

/**
 * Environment the keys service needs beyond the base service env. The service holds no database
 * connection — the root-secret payload is its entire state.
 */
export const KEYS_ENV_SHAPE = {
  ROLL_KEY_ROOTS: z
    .string()
    .min(1)
    .describe(
      'JSON payload of per-population roll-key roots: each population carries its current key version and every root version still derived against',
    ),
};
