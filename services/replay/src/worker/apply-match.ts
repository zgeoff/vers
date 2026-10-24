import { isDefinedError } from '@orpc/client';
import type { ContentDocument } from '@vers/contract-activity';
import type { SimulationDriver } from '@vers/idle-core';
import invariant from 'tiny-invariant';
import { applyVerifiedSegment } from '../apply/apply-verified-segment';
import { recordSettledXP } from '../metrics/record-settled-xp';
import { recordVerificationLag } from '../metrics/record-verification-lag';
import { readAvatarRollKey } from '../mint/read-avatar-roll-key';
import { rollRewardItems } from '../mint/roll-reward-items';
import { isForwardExited } from '../replay/is-forward-exited';
import type {
  CompareVerdict,
  ReplaySegment,
  ReplayedCheckpoint,
  RewardFact,
} from '../replay/types';
import type { MintedItem } from '../types';
import { scheduleReplayRetry } from './schedule-replay-retry';
import type {
  PendingCacheEffect,
  ReplayIterationOutcome,
  ReplayTargetContext,
  ReplayWorkerDeps,
} from './types';

interface ReplayMatch {
  readonly deadline: AbortSignal;
  readonly document: Readonly<ContentDocument>;
  readonly driver: SimulationDriver | undefined;
  readonly replayed: ReadonlyArray<ReplayedCheckpoint>;
  readonly verdict: Extract<CompareVerdict, { kind: 'match' }>;
}

export async function applyMatch(
  context: ReplayTargetContext,
  segment: Readonly<ReplaySegment>,
  match: ReplayMatch,
): Promise<ReplayIterationOutcome> {
  const verdict = match.verdict;

  match.deadline.throwIfAborted();

  const settlement = buildSettlement(segment.activity.settledXP, verdict);
  const lastReplayed = match.replayed.at(-1);
  const lastStored = segment.unverifiedCheckpoints.at(-1);

  invariant(
    lastReplayed !== undefined && lastStored !== undefined,
    'a compared segment always has at least one checkpoint',
  );

  const forwardExited = isForwardExited(lastReplayed.type, segment.activity.status);
  const advanceChain = forwardExited && lastStored.version === segment.activity.appendedHead;

  // A first clear is a verified completed terminal on a map node; a fail, stop, or cap forward-
  // exits the seed chain without clearing it, and a non-`world_map_node` scope has no completion
  // target.
  const clearedNodeID =
    lastReplayed.type === 'completed' && segment.activity.scopeType === 'world_map_node'
      ? segment.activity.scopeID
      : undefined;

  const items = await tryRollRewardItems({
    deadline: match.deadline,
    deps: context.deps,
    document: match.document,
    rewardFacts: verdict.rewardFacts,
    segment,
  });

  if (items === undefined) {
    return scheduleReplayRetry(context, segment, 'keys-unavailable');
  }

  const result = await applyVerifiedSegment(context.trx, {
    activityID: segment.activity.id,
    avatarID: segment.activity.avatarID,
    expectedVerifiedHead: segment.verifiedHead,
    ...(clearedNodeID !== undefined && {
      grants: [{ key: clearedNodeID, kind: 'first_clear' }],
    }),
    ...(items.length > 0 && { items }),
    settledXP: settlement.settledXP,
    verifiedHead: lastStored.version,
    ...(advanceChain && {
      chain: {
        chainIndex: segment.activity.startChainIndex + lastStored.version,
        nextSeed: lastReplayed.nextSeed,
        scopeID: segment.activity.scopeID,
        scopeType: segment.activity.scopeType,
      },
    }),
    xpDelta: settlement.xpDelta,
  });

  if (result.applied) {
    recordSettledXP(settlement.xpDelta, settlement.source);

    const now = Date.now();

    for (const checkpoint of segment.unverifiedCheckpoints) {
      if (checkpoint.appendedAt !== undefined) {
        recordVerificationLag((now - checkpoint.appendedAt.getTime()) / 1000);
      }
    }
  }

  const driver = match.driver;

  const effect: PendingCacheEffect =
    result.applied && !forwardExited && driver !== undefined
      ? {
          entry: { driver, emittedCount: lastStored.version, lastHash: lastStored.hash },
          kind: 'set',
        }
      : { kind: 'evict' };

  return { kind: 'matched', pendingCache: { activityID: segment.activity.id, effect } };
}

function buildSettlement(
  settledXP: number,
  verdict: Extract<CompareVerdict, { kind: 'match' }>,
): {
  readonly settledXP: number;
  readonly source: 'progress' | 'terminal';
  readonly xpDelta: number;
} {
  if (verdict.terminalXPTotal === undefined) {
    return { settledXP: settledXP + verdict.xpSum, source: 'progress', xpDelta: verdict.xpSum };
  }

  return {
    settledXP: verdict.terminalXPTotal,
    source: 'terminal',
    xpDelta: verdict.terminalXPTotal - settledXP,
  };
}

interface TryRollRewardItemsOptions {
  readonly deadline: AbortSignal;
  readonly deps: Readonly<ReplayWorkerDeps>;
  readonly document: Readonly<ContentDocument>;
  readonly rewardFacts: ReadonlyArray<RewardFact>;
  readonly segment: Readonly<ReplaySegment>;
}

// only the key read can be unavailable: a fault inside the roll itself is a bug and propagates
async function tryRollRewardItems(
  options: TryRollRewardItemsOptions,
): Promise<ReadonlyArray<MintedItem> | undefined> {
  const deadline = options.deadline;
  const segment = options.segment;

  if (options.rewardFacts.length === 0) {
    return [];
  }

  let rollKey: Uint8Array;

  try {
    rollKey = await readAvatarRollKey(
      {
        keysServiceURL: options.deps.keysServiceURL,
        privateKey: options.deps.privateKey,
        signal: deadline,
      },
      { avatarID: segment.activity.avatarID, keyVersion: segment.activity.keyVersion },
    );
  } catch (error) {
    deadline.throwIfAborted();

    if (isDefinedError(error)) {
      throw error;
    }

    return undefined;
  }

  return rollRewardItems(rollKey, {
    avatarID: segment.activity.avatarID,
    keyVersion: segment.activity.keyVersion,
    rewardFacts: options.rewardFacts,
    scopeID: segment.activity.scopeID,
    scopeType: segment.activity.scopeType,
    tables: options.document.loot,
  });
}
