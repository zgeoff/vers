import * as z from 'zod';

export const EntropySourceSchema = z.enum(['server-key', 'device-key']);

export type EntropySource = z.infer<typeof EntropySourceSchema>;
