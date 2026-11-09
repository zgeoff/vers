import * as z from 'zod';

export const QAAccountNameInvalidReasonSchema = z.enum([
  'invalid-avatar-name',
  'invalid-name',
  'invalid-username',
  'outside-qa-domain',
]);

export type QAAccountNameInvalidReason = z.infer<typeof QAAccountNameInvalidReasonSchema>;
