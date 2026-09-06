import { ActivityCheckpointType } from '@vers/idle-core';
import * as z from 'zod';

const endedRunSchema = z
  .object({
    avatarID: z.string(),
    scopeID: z.string(),
    scopeType: z.string(),
  })
  .readonly();

export const runOutcomeSchema = z
  .object({
    activityID: z.string(),
    kind: z.enum({
      Completed: ActivityCheckpointType.Completed,
      Failed: ActivityCheckpointType.Failed,
    }),
    run: endedRunSchema.exactOptional(),
    xp: z.number(),
  })
  .readonly();

export type RunOutcome = z.infer<typeof runOutcomeSchema>;
