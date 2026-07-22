import * as z from 'zod';

/**
 * Parses a checkpoint payload for the terminal xp delta it carries — a run's final earned total
 * rather than one checkpoint's own delta, the same total a verifier apply settles. Undefined for a
 * payload that doesn't parse or isn't a terminal ('completed'/'failed') type; appended data is
 * untrusted, so a malformed payload reports as absent rather than throwing.
 */
export function parseTerminalCheckpointXP(payload: unknown): number | undefined {
  const parsed = TerminalCheckpointPayloadSchema.safeParse(payload);

  if (!parsed.success || !TERMINAL_CHECKPOINT_TYPES.has(parsed.data.type)) {
    return undefined;
  }

  return parsed.data.rewards.xp;
}

/**
 * Checkpoint types whose `rewards.xp` is a run's final earned total rather than one checkpoint's
 * own delta.
 */
const TERMINAL_CHECKPOINT_TYPES = new Set(['completed', 'failed']);

const TerminalCheckpointPayloadSchema = z.object({
  rewards: z.object({ xp: z.number() }),
  type: z.string(),
});
