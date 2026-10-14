import { Collection } from '@msw/data';
import { createId } from '@paralleldrive/cuid2';
import * as z from 'zod';

const SentEmailPayloadValueSchema = z.union([z.string(), z.date()]);

const SentEmailRowSchema = z.object({
  id: z.string().default(() => createId()),
  payload: z.record(z.string(), SentEmailPayloadValueSchema).default({}),
  template: z.enum([
    'send-change-email-notification',
    'send-change-email-verification',
    'send-existing-account',
    'send-password-changed',
    'send-reset-password',
    'send-welcome',
  ]),
});

export const sentEmailCollection = new Collection({ schema: SentEmailRowSchema });
