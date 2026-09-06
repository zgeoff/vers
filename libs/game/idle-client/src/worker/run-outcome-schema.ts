import { ActivityCheckpointType } from '@vers/idle-core';
import * as z from 'zod';

const endedScopeSchema = z
  .object({
    scopeID: z.string(),
    scopeType: z.string(),
  })
  .readonly();

export const runOutcomeSchema = z
  .object({
    activityID: z.string(),
    avatarID: z.string(),
    kind: z.enum({
      Completed: ActivityCheckpointType.Completed,
      Failed: ActivityCheckpointType.Failed,
    }),
    scope: endedScopeSchema.exactOptional(),
    xp: z.number(),
  })
  .readonly();

export type RunOutcome = z.infer<typeof runOutcomeSchema>;
