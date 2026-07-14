import * as z from 'zod';

/**
 * A checkpoint's entropy-source tag: `server-key` for a server-custody roll, `device-key` for a
 * device-custody roll.
 */
export const EntropySourceSchema = z.enum(['server-key', 'device-key']);

export type EntropySource = z.infer<typeof EntropySourceSchema>;
