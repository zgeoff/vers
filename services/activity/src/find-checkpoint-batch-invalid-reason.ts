import type { CheckpointBatchEntry, CheckpointPayload } from '@vers/contract-activity';
import { RewardSlotSchema, buildCheckpointHashFromEntry } from '@vers/contract-activity';
import { isTerminalCheckpointType } from '@vers/idle-core';
import * as z from 'zod';

interface CheckpointBatchInput {
  readonly checkpoints: ReadonlyArray<CheckpointBatchEntry>;
  readonly expectedHead: number;
}

/**
 * The append target's chain-link state a batch validates against — the row's own fields for
 * `trackActivityProgress`, or a freshly minted row's starting state for `advanceActivity`.
 */
export interface CheckpointBatchHead {
  readonly appendedHead: number;
  readonly appendedTimeMs: number;
  readonly lastHash: string;
  readonly startChainIndex: number;
}

/**
 * Validates a checkpoint batch's internal shape ahead of the transactional head-row
 * compare-and-swap:
 *
 * - version contiguity from `expectedHead + 1`
 * - each entry's `chainIndex` continuity from `head.startChainIndex`
 * - no run-ending entry before the batch's last — only the last entry claims the activity's
 *   terminal transition, so an interior one would store a terminal the settlement rule never reads
 * - each entry's optional `rewardSlots` shape and ordinal contiguity
 * - each entry's optional `rewards.xp` fitting postgres `integer`
 * - each entry's `time` landing on an exact integer millisecond
 * - each entry's cumulative `time` never regressing: within the batch always, and from the head
 *   row's accounted time only when `expectedHead` still matches the head row, since a stale batch
 *   predates that value
 * - each entry's hash against its own payload, each entry's chain link to the previous one, and —
 *   when `expectedHead` matches the head row — the first entry's link onto the current head
 */
export function findCheckpointBatchInvalidReason(
  input: Readonly<CheckpointBatchInput>,
  head: Readonly<CheckpointBatchHead>,
): string | undefined {
  const headMatches = input.expectedHead === head.appendedHead;
  let previousTime = headMatches ? head.appendedTimeMs : undefined;

  for (const [index, checkpoint] of input.checkpoints.entries()) {
    const expectedVersion = input.expectedHead + index + 1;

    if (checkpoint.version !== expectedVersion) {
      return 'non-contiguous-versions';
    }

    if (checkpoint.payload.chainIndex !== head.startChainIndex + checkpoint.version) {
      return 'non-contiguous-chain-index';
    }

    const isLast = index === input.checkpoints.length - 1;

    if (!isLast && isTerminalCheckpointType(checkpoint.payload.type)) {
      return 'terminal-not-last';
    }

    const rewardSlotsReason = findRewardSlotsInvalidReason(checkpoint.payload);

    if (rewardSlotsReason !== undefined) {
      return rewardSlotsReason;
    }

    const rewardsReason = findRewardsInvalidReason(checkpoint.payload);

    if (rewardsReason !== undefined) {
      return rewardsReason;
    }

    // A fractional time would round down when it lands in `appended_time_ms` (the head row's
    // cached mirror of the last appended checkpoint's cumulative time), letting the next batch's
    // cross-batch regression comparison pass against a value up to 1 ms short of what this
    // checkpoint claims — silently permitting a regression the exact value would have caught.
    if (!Number.isInteger(checkpoint.payload.time)) {
      return 'non-integer-time';
    }

    // The negated >= also rejects a NaN time, which would otherwise slip through as a 0 delta.
    if (previousTime !== undefined && !(checkpoint.payload.time >= previousTime)) {
      return 'time-regression';
    }

    previousTime = checkpoint.payload.time;

    let previousHash: string | undefined;

    if (index === 0) {
      previousHash = headMatches ? head.lastHash : undefined;
    } else {
      previousHash = input.checkpoints[index - 1]?.hash;
    }

    if (previousHash !== undefined && checkpoint.prevHash !== previousHash) {
      return 'broken-chain-link';
    }

    const expectedHash = buildCheckpointHashFromEntry(checkpoint);

    if (expectedHash !== checkpoint.hash) {
      return 'hash-mismatch';
    }
  }

  return undefined;
}

const RewardSlotsSchema = z.array(RewardSlotSchema);

/**
 * A checkpoint's `rewardSlots` field rides outside the hashed subset like `rewards`, so it's
 * validated here rather than by the payload schema. Absent is valid — an older client or a
 * checkpoint that dropped nothing carries no key at all. Present, it must parse and its ordinals
 * must run contiguous from 0 in list order.
 */
function findRewardSlotsInvalidReason(payload: Readonly<CheckpointPayload>): string | undefined {
  if (!('rewardSlots' in payload)) {
    return undefined;
  }

  const parsed = RewardSlotsSchema.safeParse(payload['rewardSlots']);

  if (!parsed.success) {
    return 'invalid-reward-slots';
  }

  const isContiguous = parsed.data.every((slot, index) => slot.ordinal === index);

  return isContiguous ? undefined : 'invalid-reward-slots';
}

const RewardsSchema = z.looseObject({ xp: z.int32().optional() });

/**
 * A checkpoint's `rewards` field rides outside the hashed subset, so it's validated here rather
 * than by the payload schema. Absent is valid — a checkpoint that earned nothing carries no key at
 * all. Present, `xp` must fit postgres `integer`: readers aggregate it with a cast that fails the
 * whole statement on a fractional, non-numeric, or out-of-range value, and the offending
 * checkpoint would keep failing it on every later read.
 */
function findRewardsInvalidReason(payload: Readonly<CheckpointPayload>): string | undefined {
  if (!('rewards' in payload)) {
    return undefined;
  }

  return RewardsSchema.safeParse(payload['rewards']).success ? undefined : 'invalid-rewards';
}
