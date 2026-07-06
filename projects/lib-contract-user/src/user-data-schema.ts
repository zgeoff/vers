import * as z from 'zod';

/** A user as returned to callers; strips `passwordHash` and password-reset fields. */
export const UserDataSchema = z.object({
  createdAt: z.date(),
  email: z.string(),
  id: z.string(),
  name: z.string(),
  seed: z.int(),
  updatedAt: z.date(),
  username: z.string(),
});

export type UserData = z.infer<typeof UserDataSchema>;
