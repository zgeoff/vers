import { isDefinedError } from '@orpc/client';
import type { ContentDocument } from '@vers/contract-activity';
import type { DB } from '@vers/db';
import type { SimulationDriver } from '@vers/idle-core';
import type { Transaction } from 'kysely';
import invariant from 'tiny-invariant';
import { applyVerifiedSegment } from '../apply/apply-verified-segment';
import { recordSettledXP } from '../metrics/record-settled-xp';
import { recordVerificationLag } from '../metrics/record-verification-lag';
import { readAvatarRollKey } from '../mint/read-avatar-roll-key';
import { rollRewardItems } from '../mint/roll-reward-items';
import type { ReplayCache } from '../replay/create-replay-cache';
import { isForwardExited } from '../replay/is-forward-exited';
import type {
  CompareVerdict,
  ReplaySegment,
  ReplayedCheckpoint,
  RewardFact,
} from '../replay/types';
import type { MintedItem } from '../types';
import { scheduleReplayRetry } from './schedule-replay-retry';
import type { PendingCacheEffect, ReplayIterationOutcome, ReplayWorkerDeps } from './types';

export async function applyMatch(
  trx: Transaction<DB>,
  deps: Readonly<ReplayWorkerDeps>,
  cache: ReplayCache,
  segment: Readonly<ReplaySegment>,
  replayed: ReadonlyArray<ReplayedCheckpoint>,
  driver: SimulationDriver | undefined,
  verdict: Extract<CompareVerdict, { kind: 'match' }>,
  document: Readonly<ContentDocument>,
  deadline: AbortSignal,
): Promise<ReplayIterationOutcome> {
  deadline.throwIfAborted();

  const settlement = buildSettlement(segment.activity.settledXP, verdict);
  const lastReplayed = replayed.at(-1);
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

  const items = await tryRollRewardItems(deps, segment, verdict.rewardFacts, document, deadline);

  if (items === undefined) {
    return scheduleReplayRetry(trx, deps, cache, segment, 'keys-unavailable');
  }

  const result = await applyVerifiedSegment(trx, {
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

// only the key read can be unavailable: a fault inside the roll itself is a bug and propagates
async function tryRollRewardItems(
  deps: Readonly<ReplayWorkerDeps>,
  segment: Readonly<ReplaySegment>,
  rewardFacts: ReadonlyArray<RewardFact>,
  document: Readonly<ContentDocument>,
  deadline: AbortSignal,
): Promise<ReadonlyArray<MintedItem> | undefined> {
  if (rewardFacts.length === 0) {
    return [];
  }

  let rollKey: Uint8Array;

  try {
    rollKey = await readAvatarRollKey(
      { keysServiceURL: deps.keysServiceURL, privateKey: deps.privateKey, signal: deadline },
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
    rewardFacts,
    scopeID: segment.activity.scopeID,
    scopeType: segment.activity.scopeType,
    tables: document.loot,
  });
}
