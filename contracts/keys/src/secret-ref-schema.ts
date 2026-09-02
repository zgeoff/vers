import * as z from 'zod';

export const SecretRefSchema = z.enum(['worldmap']);

export type SecretRef = z.infer<typeof SecretRefSchema>;
