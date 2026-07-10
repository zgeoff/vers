import { Collection } from '@msw/data';
import { createId } from '@paralleldrive/cuid2';
import { VerificationDataSchema } from '@vers/contract-verification';
import * as z from 'zod';

/**
 * A stored mock verification row: the public `VerificationDataSchema` plus its code and expiry.
 * `type` stays required: a verification is meaningless without the flow it gates, so tests must
 * state it.
 */
const VerificationRowSchema = VerificationDataSchema.extend({
  code: z.string().default('123456'),
  expiresAt: z.date().nullable().default(null),
  id: z.string().default(() => createId()),
  target: z.string().default(() => createId()),
});

export const verificationCollection = new Collection({ schema: VerificationRowSchema });
