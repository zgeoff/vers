import * as z from 'zod';

/** Public shape of an authenticated user, as returned by the user service. */
export const UserSchema = z.object({
  id: z.string(),
  email: z.string(),
  displayName: z.string(),
});

export type User = z.infer<typeof UserSchema>;
