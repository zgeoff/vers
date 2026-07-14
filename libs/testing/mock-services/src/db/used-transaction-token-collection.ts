import { faker } from '@faker-js/faker';
import { Collection } from '@msw/data';
import { createId } from '@paralleldrive/cuid2';
import * as z from 'zod';

/**
 * One step-up transaction token's single-use consumption record, keyed by its JWT `jti` claim.
 * Both fields default, so tests state only the `jti` they replay or assert on.
 */
const UsedTransactionTokenRowSchema = z.object({
  expiresAt: z.date().default(() => faker.date.soon()),
  jti: z.string().default(() => createId()),
});

export const usedTransactionTokenCollection = new Collection({
  schema: UsedTransactionTokenRowSchema,
});
