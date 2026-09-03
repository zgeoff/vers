import { faker } from '@faker-js/faker';
import { Collection } from '@msw/data';
import { createId } from '@paralleldrive/cuid2';
import * as z from 'zod';

const UsedTransactionTokenRowSchema = z.object({
  expiresAt: z.date().default(() => faker.date.soon()),
  jti: z.string().default(() => createId()),
});

export const usedTransactionTokenCollection = new Collection({
  schema: UsedTransactionTokenRowSchema,
});
