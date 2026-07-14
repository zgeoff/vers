import { Collection } from '@msw/data';
import { createId } from '@paralleldrive/cuid2';
import * as z from 'zod';

/**
 * A stored mock sent-email row, one per enqueued send, mirroring the email service's delivery
 * queue rows: `template` is the queue's job name and `payload` its job data — the verbatim send
 * input, `to` included.
 */
const SentEmailRowSchema = z.object({
  id: z.string().default(() => createId()),
  payload: z.record(z.string(), z.string()).default({}),
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
