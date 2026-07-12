import * as z from 'zod';

/**
 * Server-side truth an activity is played against, captured at start time so a later avatar
 * change can't retroactively alter a stream already in flight.
 */
export const BuildSnapshotSchema = z.object({
  level: z.int(),
  xp: z.int(),
});

export type BuildSnapshot = z.infer<typeof BuildSnapshotSchema>;
