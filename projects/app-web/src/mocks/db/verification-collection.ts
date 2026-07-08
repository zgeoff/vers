import { Collection } from '@msw/data';
import { VerificationDataSchema } from '@vers/contract-verification';
import * as z from 'zod';

/** A stored mock verification row: the public `VerificationDataSchema` plus its code and expiry. */
export const VerificationRowSchema = VerificationDataSchema.extend({
  code: z.string().default('123456'),
  expiresAt: z.date().nullable().default(null),
});

export const verificationCollection = new Collection({ schema: VerificationRowSchema });
