import * as z from 'zod';
import { ActivityInputSchema } from './activity-input-schema';
import { AvatarDataSchema } from './avatar-data-schema';

/**
 * Wire input to the replay provider endpoint: everything the engine needs to replay a segment from
 * a `Started` snapshot.
 */
export const ReplaySegmentInputSchema = z.object({
  activity: ActivityInputSchema,
  avatar: AvatarDataSchema,
  duration: z.number(),

  /**
   * The segment's own known checkpoint count — the primary halt for the provider's engine, with
   * `duration` only the safety cap behind it. Omitted by an older dispatcher that predates the
   * field.
   */
  expectedCheckpointCount: z.number().int().positive().optional(),

  /**
   * Called cross-version — today's dispatcher can call a provider frozen weeks ago — so this
   * field only ever evolves additively.
   */
  protocol: z.literal(1),
  simVersion: z.string(),
  stopAtState: z.string().optional(),
});

export type ReplaySegmentInput = z.infer<typeof ReplaySegmentInputSchema>;
