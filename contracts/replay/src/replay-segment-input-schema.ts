import * as z from 'zod';
import { ActivityInputSchema } from './activity-input-schema';
import { AvatarDataSchema } from './avatar-data-schema';

export const ReplaySegmentInputSchema = z.object({
  activity: ActivityInputSchema,
  avatar: AvatarDataSchema,
  duration: z.number(),

  expectedCheckpointCount: z.number().int().positive().optional(),

  protocol: z.literal(1),
  simVersion: z.string(),
  stopAtState: z.string().optional(),
});

export type ReplaySegmentInput = z.infer<typeof ReplaySegmentInputSchema>;
