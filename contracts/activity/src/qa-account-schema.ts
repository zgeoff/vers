import * as z from 'zod';

const QARunSchema = z.object({
  checkpoints: z.int(),
  id: z.string(),
  items: z.int(),
  outcome: z.enum(['completed', 'failed']),
  xpDelta: z.int(),
});

export const QAAccountSchema = z.object({
  avatar: z.object({ id: z.string(), level: z.int(), name: z.string(), xp: z.int() }),
  password: z.string(),
  runs: z.array(QARunSchema),
  twoFactor: z.object({ secret: z.string(), uri: z.string() }).nullable(),
  user: z.object({ email: z.string(), id: z.string(), username: z.string() }),
});

export type QAAccount = z.infer<typeof QAAccountSchema>;
