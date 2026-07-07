import { Collection } from '@msw/data';
import * as z from 'zod';

/** One step-up transaction token's single-use consumption record, keyed by its JWT `jti` claim. */
export const UsedTransactionTokenRowSchema = z.object({
  expiresAt: z.date(),
  jti: z.string(),
});

export const usedTransactionTokenCollection = new Collection({
  schema: UsedTransactionTokenRowSchema,
});
