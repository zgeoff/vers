import * as z from 'zod';

export const SendChangeEmailNotificationInputSchema = z.object({ to: z.email() });

export type SendChangeEmailNotificationInput = z.infer<
  typeof SendChangeEmailNotificationInputSchema
>;
