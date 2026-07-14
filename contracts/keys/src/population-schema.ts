import * as z from 'zod';

/**
 * The two separately-rooted key populations: `'trade'` keys are held by the server, `'self-found'`
 * keys are held by the device.
 */
export const PopulationSchema = z.enum(['trade', 'self-found']);

export type Population = z.infer<typeof PopulationSchema>;
