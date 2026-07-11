import * as z from 'zod';

/**
 * The change-email notification template takes no props beyond the recipient.
 */
export const SendChangeEmailNotificationInputSchema = z.object({ to: z.email() });

export type SendChangeEmailNotificationInput = z.infer<
  typeof SendChangeEmailNotificationInputSchema
>;
