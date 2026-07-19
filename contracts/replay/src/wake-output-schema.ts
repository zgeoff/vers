import * as z from 'zod';

/**
 * Wire output of the queue-drain endpoint: how many chains the drain claimed and adjudicated
 * before finding the queue empty.
 */
export const WakeOutputSchema = z.object({ drained: z.int() });

export type WakeOutput = z.infer<typeof WakeOutputSchema>;
