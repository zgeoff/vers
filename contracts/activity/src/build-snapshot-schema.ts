import * as z from 'zod';

export const BuildSnapshotSchema = z.object({
  level: z.int(),
  xp: z.int(),
});

export type BuildSnapshot = z.infer<typeof BuildSnapshotSchema>;
