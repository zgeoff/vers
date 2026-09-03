import * as z from 'zod';

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
