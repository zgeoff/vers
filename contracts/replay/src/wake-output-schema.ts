import * as z from 'zod';

export const WakeOutputSchema = z.object({ drained: z.int() });

export type WakeOutput = z.infer<typeof WakeOutputSchema>;
