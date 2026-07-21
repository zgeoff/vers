import type { CheckpointPayload, EntropySource, RewardSlot } from '@vers/contract-activity';
import { buildCheckpointHash } from '@vers/contract-activity';
import { TERMINAL_CHECKPOINT_TYPES } from './types';
import type { CompareVerdict, ReplayedCheckpoint, RewardFact, StoredCheckpoint } from './types';

/**
 * The sole legal entropy-source tag: the checkpoint chain is derived only from server-held key
 * material.
 */
const SERVER_KEY_ENTROPY_SOURCE: EntropySource = 'server-key';

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
    const firstUnmatched = stored[Math.min(stored.length, replayed.length)];
    const version = firstUnmatched?.version ?? (stored.at(-1)?.version ?? 0) + 1;

    return { kind: 'divergence', reason: 'checkpoint-count-mismatch', version };
  }

  let prevHash = context.prevHash;
  let seed = context.seed;
  const rewardFacts: Array<RewardFact> = [];

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

    if (
      !hasMatchingLevelUp(findPayloadLevelUp(storedCheckpoint.payload), replayedCheckpoint.levelUp)
    ) {
      return { kind: 'divergence', reason: 'reward-mismatch', version };
    }

    const storedRewardSlots = parsePayloadRewardSlots(storedCheckpoint.payload);

    if (storedRewardSlots.kind === 'malformed') {
      return { kind: 'divergence', reason: 'reward-mismatch', version };
    }

    const storedSlots = storedRewardSlots.kind === 'present' ? storedRewardSlots.slots : undefined;

    if (!hasMatchingRewardSlots(storedSlots, replayedCheckpoint.rewardSlots)) {
      return { kind: 'divergence', reason: 'reward-mismatch', version };
    }

    for (const slot of replayedCheckpoint.rewardSlots ?? []) {
      rewardFacts.push({
        chainIndex: context.startChainIndex + version,
        nodeTier: slot.context.nodeTier,
        ordinal: slot.ordinal,
      });
    }

    prevHash = hash;
    seed = replayedCheckpoint.nextSeed;
  }

  const lastReplayed = replayed.at(-1);
  const isTerminal = lastReplayed !== undefined && TERMINAL_CHECKPOINT_TYPES.has(lastReplayed.type);

  return {
    kind: 'match',
    rewardFacts,
    verifiedXPDelta: isTerminal ? (lastReplayed?.rewards.xp ?? 0) : 0,
  };
}

/**
 * A plain, non-array object — the shape every structural guard below narrows a raw payload field
 * onto before reading its own fields.
 */
function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * A number the hash chain would accept: finite, excluding the `NaN`/`Infinity` values `typeof`
 * alone lets through.
 */
function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

/**
 * A stored checkpoint's `rewards` field rides outside the hashed subset, so
 * `CheckpointPayloadSchema` doesn't type it — this reads it from the loose object the same way the
 * append path does, reporting undefined for a missing or malformed shape rather than throwing.
 */
function findPayloadRewardsXP(payload: Readonly<CheckpointPayload>): number | undefined {
  const rewards = payload['rewards'];

  return isRecord(rewards) && isFiniteNumber(rewards['xp']) ? rewards['xp'] : undefined;
}

/**
 * A stored checkpoint's `levelUp` field rides outside the hashed subset like `rewards`, and is
 * absent from the payload entirely on a checkpoint that crossed no level.
 */
function findPayloadLevelUp(
  payload: Readonly<CheckpointPayload>,
): { from: number; to: number } | undefined {
  const levelUp = payload['levelUp'];

  if (!isRecord(levelUp) || !isFiniteNumber(levelUp['from']) || !isFiniteNumber(levelUp['to'])) {
    return undefined;
  }

  return { from: levelUp['from'], to: levelUp['to'] };
}

function hasMatchingLevelUp(
  stored: Readonly<{ from: number; to: number }> | undefined,
  replayed: Readonly<{ from: number; to: number }> | undefined,
): boolean {
  if (stored === undefined || replayed === undefined) {
    return stored === replayed;
  }

  return stored.from === replayed.from && stored.to === replayed.to;
}

type ParsedRewardSlots =
  | { readonly kind: 'absent' }
  | { readonly kind: 'malformed' }
  | { readonly kind: 'present'; readonly slots: ReadonlyArray<RewardSlot> };

/**
 * A safe, non-negative integer — the shape a reward slot's `ordinal` and `context.nodeTier` fields
 * must satisfy, floored at the given minimum.
 */
function isSafeIntAtLeast(value: unknown, min: number): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= min;
}

function isRewardSlot(value: unknown): value is RewardSlot {
  return (
    isRecord(value) &&
    isSafeIntAtLeast(value['ordinal'], 0) &&
    isRecord(value['context']) &&
    isSafeIntAtLeast(value['context']['nodeTier'], 1)
  );
}

/**
 * A stored checkpoint's `rewardSlots` field rides outside the hashed subset like `rewards`. An
 * absent field is a checkpoint minted before the field existed and normalizes to nothing dropped;
 * a present-but-malformed value is a bug or tamper the caller must diverge on, so the two are kept
 * distinct rather than both collapsing to empty.
 */
function parsePayloadRewardSlots(payload: Readonly<CheckpointPayload>): ParsedRewardSlots {
  const rewardSlots = payload['rewardSlots'];

  if (rewardSlots === undefined) {
    return { kind: 'absent' };
  }

  return Array.isArray(rewardSlots) &&
    rewardSlots.every((slot): slot is RewardSlot => isRewardSlot(slot))
    ? { kind: 'present', slots: rewardSlots }
    : { kind: 'malformed' };
}

/**
 * Compares two reward-slot lists positionally after normalizing a missing list to empty — an old
 * engine's checkpoint and an old provider's wire response both simply lack the field, so
 * absent-in-both reads as the same "nothing dropped" fact as an explicit empty list.
 */
function hasMatchingRewardSlots(
  stored: ReadonlyArray<RewardSlot> | undefined,
  replayed: ReadonlyArray<RewardSlot> | undefined,
): boolean {
  const storedSlots = stored ?? [];
  const replayedSlots = replayed ?? [];

  if (storedSlots.length !== replayedSlots.length) {
    return false;
  }

  return storedSlots.every((slot, index) => {
    const other = replayedSlots[index];

    return (
      other !== undefined &&
      slot.ordinal === other.ordinal &&
      slot.context.nodeTier === other.context.nodeTier
    );
  });
}
