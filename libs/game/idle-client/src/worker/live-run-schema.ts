import * as z from 'zod';

export const liveRunSchema = z
  .object({
    avatarID: z.string(),
    id: z.string(),
    scopeID: z.string(),
    scopeType: z.string(),
  })
  .readonly();

export type LiveRun = z.infer<typeof liveRunSchema>;
