import { faker } from '@faker-js/faker';
import { Collection } from '@msw/data';
import { createId } from '@paralleldrive/cuid2';
import * as z from 'zod';

/**
 * A stored mock sent-email row, one per enqueued send. `template` stays required — it's what the
 * row is for — and every other field defaults, including the templates' own optional payload
 * fields, so tests state only the fields their assertions depend on.
 */
const SentEmailRowSchema = z.object({
  email: z.string().default(() => faker.internet.email()),
  id: z.string().default(() => createId()),
  newEmail: z.string().default(() => faker.internet.email()),
  resetURL: z.string().default(() => faker.internet.url()),
  template: z.enum([
    'welcome',
    'existing-account',
    'change-email-verification',
    'change-email-notification',
    'reset-password',
    'password-changed',
  ]),
  to: z.string().default(() => faker.internet.email()),
  verificationCode: z.string().default(() => faker.string.numeric(6)),
  verificationURL: z.string().default(() => faker.internet.url()),
});

export const sentEmailCollection = new Collection({ schema: SentEmailRowSchema });
