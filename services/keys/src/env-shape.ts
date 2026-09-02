import * as z from 'zod';

export const envShape = {
  ROLL_KEY_ROOTS: z
    .string()
    .min(1)
    .describe(
      'JSON payload of per-population roll-key roots: each population carries its current key version and every root version still derived against',
    ),
  SCOPE_SECRET_ROOTS: z
    .string()
    .min(1)
    .describe(
      'JSON payload of per-scope secret roots: each scope carries its current secret version and every root version still derived against',
    ),
};
