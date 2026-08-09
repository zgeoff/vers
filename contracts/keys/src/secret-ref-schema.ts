import * as z from 'zod';

/**
 * The scope secrets custodied by the keys service, each rooted in its own env-provisioned secret.
 */
export const SecretRefSchema = z.enum(['worldmap']);

export type SecretRef = z.infer<typeof SecretRefSchema>;
