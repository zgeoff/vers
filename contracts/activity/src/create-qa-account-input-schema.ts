import * as z from 'zod';

// an avatar's xp is a 4-byte integer column, and the threshold of level 1000 still fits it
const QA_ACCOUNT_MAX_LEVEL = 1000;

// the service simulates every seeded run inside one request, which the edge bounds at 24s
const QA_ACCOUNT_MAX_RUNS = 20;

export const CreateQAAccountInputSchema = z
  .object({
    level: z.int().min(1).max(QA_ACCOUNT_MAX_LEVEL),
    password: z.string().min(1).optional(),
    runs: z.int().min(0).max(QA_ACCOUNT_MAX_RUNS),
    twoFactor: z.boolean(),
    user: z.string().min(1),
  })
  .refine((input) => input.level === 1 || input.runs > 0, {
    // with no activity row to resync from, the game client folds its first start from xp 0, and the
    // activity service refuses any start whose snapshot differs from the avatar's stored xp
    message:
      'a level above 1 needs at least 1 run: an avatar above level 1 with no run cannot start one',
    path: ['runs'],
  });

export type CreateQAAccountInput = z.infer<typeof CreateQAAccountInputSchema>;
