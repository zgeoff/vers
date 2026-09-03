import * as z from 'zod';

export const SessionDataSchema = z.object({
  createdAt: z.date(),
  expiresAt: z.date(),
  id: z.string(),
  ipAddress: z.string(),
  updatedAt: z.date(),
  userID: z.string(),
  verified: z.boolean(),
});

export type SessionData = z.infer<typeof SessionDataSchema>;
