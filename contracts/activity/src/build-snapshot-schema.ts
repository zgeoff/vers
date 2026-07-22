import * as z from 'zod';

/**
 * Server-side truth an activity is played against, captured at start time so a later avatar
 * change can't retroactively alter a stream already in flight.
 *
 * Every field here is stamped from totals that may include what unverified runs earned, and the
 * verifier replays against the stamped value rather than re-deriving it. A field added here widens
 * what a new activity can borrow ahead of verification, so the provenance recorded at start widens
 * with it: a borrowed quantity whose lending runs go unrecorded verifies clean against progress the
 * avatar never proved. Level and xp are the borrowable quantities — an item mints only for a
 * verified segment, so an unverified run has none to lend.
 */
export const BuildSnapshotSchema = z.object({
  level: z.int(),
  xp: z.int(),
});

export type BuildSnapshot = z.infer<typeof BuildSnapshotSchema>;
