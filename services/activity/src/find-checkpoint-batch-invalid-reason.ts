import type {
  CheckpointBatchEntry,
  CheckpointInvalidReason,
  CheckpointPayload,
} from '@vers/contract-activity';
import { RewardSlotSchema, buildCheckpointHashFromEntry } from '@vers/contract-activity';
import { isTerminalCheckpointType } from '@vers/idle-core';
import * as z from 'zod';

interface CheckpointBatchInput {
  readonly checkpoints: ReadonlyArray<CheckpointBatchEntry>;
  readonly expectedHead: number;
}

export interface CheckpointBatchHead {
  readonly appendedHead: number;
  readonly appendedTimeMs: number;
  readonly lastHash: string;
  readonly startChainIndex: number;
}

export function findCheckpointBatchInvalidReason(
  input: Readonly<CheckpointBatchInput>,
  head: Readonly<CheckpointBatchHead>,
): CheckpointInvalidReason | undefined {
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

    // a fractional time rounds down when the head row caches it in a bigint column, so the next
    // batch's cross-batch regression check would compare against a value up to 1 ms short of what
    // this checkpoint claimed
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

function findRewardSlotsInvalidReason(
  payload: Readonly<CheckpointPayload>,
): CheckpointInvalidReason | undefined {
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

// xp is bounded to int32 because readers sum it through a SQL integer cast that fails the whole
// statement on any other value, and would keep failing on every later read
const RewardsSchema = z.looseObject({ xp: z.int32().optional() });

function findRewardsInvalidReason(
  payload: Readonly<CheckpointPayload>,
): CheckpointInvalidReason | undefined {
  if (!('rewards' in payload)) {
    return undefined;
  }

  return RewardsSchema.safeParse(payload['rewards']).success ? undefined : 'invalid-rewards';
}
