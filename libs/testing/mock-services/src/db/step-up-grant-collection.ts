import { faker } from '@faker-js/faker';
import { Collection } from '@msw/data';
import { createId } from '@paralleldrive/cuid2';
import { SecureActionSchema } from '@vers/contract-session';
import * as z from 'zod';

const StepUpGrantRowSchema = z.object({
  action: SecureActionSchema.default('ChangeEmail'),
  expiresAt: z.date().default(() => faker.date.soon()),
  sessionID: z.string().nullable().default(null),
  target: z.string().default(() => createId()),
  token: z.string().default(() => createId()),
});

export const stepUpGrantCollection = new Collection({
  schema: StepUpGrantRowSchema,
});
