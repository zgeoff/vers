import { Collection } from '@msw/data';
import { createId } from '@paralleldrive/cuid2';
import { VerificationDataSchema } from '@vers/contract-verification';
import * as z from 'zod';

const VerificationRowSchema = VerificationDataSchema.extend({
  code: z.string().default('123456'),
  expiresAt: z.date().nullable().default(null),
  id: z.string().default(() => createId()),
  target: z.string().default(() => createId()),
});

export const verificationCollection = new Collection({ schema: VerificationRowSchema });
