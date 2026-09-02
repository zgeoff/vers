import * as z from 'zod';

export const PopulationSchema = z.enum(['trade', 'self-found']);

export type Population = z.infer<typeof PopulationSchema>;
