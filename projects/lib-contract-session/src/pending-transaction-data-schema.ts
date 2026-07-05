import * as z from 'zod';
import { SecureActionSchema } from './secure-action-schema';

/** Durable state behind a step-up transaction; the token itself is minted at the edge. */
export const PendingTransactionDataSchema = z.object({
  action: SecureActionSchema,
  attempts: z.int(),
  expiresAt: z.date(),
  id: z.string(),
  ipAddress: z.string(),
  sessionID: z.string().nullable(),
  target: z.string(),
});

export type PendingTransactionData = z.infer<typeof PendingTransactionDataSchema>;
