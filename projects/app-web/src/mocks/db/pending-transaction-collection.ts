import { faker } from '@faker-js/faker';
import { Collection } from '@msw/data';
import { createId } from '@paralleldrive/cuid2';
import { PendingTransactionDataSchema } from '@vers/contract-session';
import * as z from 'zod';

/**
 * A stored mock pending step-up transaction. `action` stays required — it's what the row is for —
 * and every other field defaults to a live, consumable, fresh-attempt state, so tests state only
 * the fields they wire between rows or assert on.
 */
export const PendingTransactionRowSchema = PendingTransactionDataSchema.extend({
  attempts: z.int().default(0),
  expiresAt: z.date().default(() => faker.date.soon()),
  id: z.string().default(() => createId()),
  ipAddress: z.string().default(() => faker.internet.ipv4()),
  sessionID: z.string().nullable().default(null),
  target: z.string().default(() => createId()),
});

export const pendingTransactionCollection = new Collection({
  schema: PendingTransactionRowSchema,
});
