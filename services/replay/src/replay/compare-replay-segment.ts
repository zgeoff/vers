import type { CheckpointPayload, EntropySource } from '@vers/contract-activity';
import { buildCheckpointHash } from '@vers/contract-activity';
import * as z from 'zod';
import type { CompareVerdict, ReplayedCheckpoint, StoredCheckpoint } from './types';

/**
 * The sole legal entropy-source tag until #467/#470 land mode-aware validation and self-found
 * verification.
 */
const SERVER_KEY_ENTROPY_SOURCE: EntropySource = 'server-key';

/**
 * Checkpoint types whose engine restart resets the next checkpoint's `time` to zero — a segment
 * ending on one settles as this batch's terminal outcome, and `advanceDriverThroughCheckpoints`
 * reads the same set to find where a duration derived from stored checkpoints must reset too.
 */
export const TERMINAL_CHECKPOINT_TYPES: ReadonlySet<string> = new Set(['completed', 'failed']);

interface CompareContext {
  readonly prevHash: string;
  readonly seed: string;
  readonly startChainIndex: number;
}

/**
 * Compares a segment's stored checkpoint rows against a fresh replay's output. A mismatched
 * checkpoint count is itself divergence — a submitted stream that doesn't match what the same
 * duration honestly produces. Otherwise, one version at a time: `chainIndex`, `entropySource`, and
 * every hashed field are recomputed from the replay and the running chain position — never read
 * from the stored payload — and the recomputed hash must byte-match the stored one. Rewards ride
 * outside the hash, so a checkpoint's `rewards.xp` is compared directly against the replay's own
 * value. The two inputs are positionally aligned: `replayed[i]` is what the engine produced for
 * `stored[i].version`.
 */
export function compareReplaySegment(
  stored: ReadonlyArray<StoredCheckpoint>,
  replayed: ReadonlyArray<ReplayedCheckpoint>,
  context: Readonly<CompareContext>,
): CompareVerdict {
  if (stored.length !== replayed.length) {
    return {
      kind: 'divergence',
      reason: 'checkpoint-count-mismatch',
      version: Math.min(stored.length, replayed.length) + 1,
    };
  }

  let prevHash = context.prevHash;
  let seed = context.seed;

  for (const [index, storedCheckpoint] of stored.entries()) {
    // oxlint-disable-next-line typescript/no-non-null-assertion -- index bounds guarded by the length invariant above
    const replayedCheckpoint = replayed[index]!;
    const version = storedCheckpoint.version;
    const checkpointSeed = replayedCheckpoint.seed ?? seed;

    const hash = buildCheckpointHash({
      chainIndex: context.startChainIndex + version,
      entropySource: SERVER_KEY_ENTROPY_SOURCE,
      nextSeed: replayedCheckpoint.nextSeed,
      prevHash,
      seed: checkpointSeed,
      time: replayedCheckpoint.time,
      type: replayedCheckpoint.type,
      version,
    });

    if (hash !== storedCheckpoint.hash) {
      return { kind: 'divergence', reason: 'hash-mismatch', version };
    }

    const storedXP = findPayloadRewardsXP(storedCheckpoint.payload);

    if (storedXP === undefined || storedXP !== replayedCheckpoint.rewards.xp) {
      return { kind: 'divergence', reason: 'reward-mismatch', version };
    }

    prevHash = hash;
    seed = replayedCheckpoint.nextSeed;
  }

  const lastReplayed = replayed.at(-1);
  const isTerminal = lastReplayed !== undefined && TERMINAL_CHECKPOINT_TYPES.has(lastReplayed.type);

  return {
    kind: 'match',
    rewardFacts: [],
    verifiedXPDelta: isTerminal ? (lastReplayed?.rewards.xp ?? 0) : 0,
  };
}

const RewardsSchema = z.object({ xp: z.number() });

/**
 * A stored checkpoint's `rewards` field rides outside the hashed subset, so
 * `CheckpointPayloadSchema` doesn't type it — this reads it from the loose object the same way the
 * append path does, reporting undefined for a missing or malformed shape rather than throwing.
 */
function findPayloadRewardsXP(payload: Readonly<CheckpointPayload>): number | undefined {
  const parsed = RewardsSchema.safeParse(payload['rewards']);

  return parsed.success ? parsed.data.xp : undefined;
}
