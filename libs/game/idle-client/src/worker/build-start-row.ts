import { createId } from '@paralleldrive/cuid2';
import type { ActivityData } from '@vers/contract-activity';
import { buildStartHash } from '@vers/contract-activity';
import { buildLevelFromXP, foldOptimisticBuild } from '@vers/idle-core';
import { readNodeSeed } from '../submission/read-node-seed';
import { readStartStamps } from '../submission/read-start-stamps';
import type { WorkerContext } from './types';

interface BuildStartRowInput {
  readonly avatarID: string;
  readonly scopeID: string;
  readonly scopeType: string;
  readonly startKey: string;
}

/**
 * Synthesizes a full `ActivityData` root row for a start, entirely from this device's cached
 * inputs — `null` when any of them is missing, since no local mint is possible without every one:
 * the scope's cached node seed (never revealed on this device, revealed for a different avatar, or
 * cached before `head` existed), the account's cached crypto stamps, or the build's bundled engine
 * hash (undefined in a dev build, which has no local fallback). The chain roots at the node's
 * cached head rather than its genesis, so a revisited node's start continues from where play
 * actually left off.
 * `buildSnapshot` is a client-side optimistic guess — a hint the server re-authors and
 * exact-match-rejects at submission time, never a value this mint depends on for its own
 * correctness.
 */
export async function buildStartRow(
  context: WorkerContext,
  input: Readonly<BuildStartRowInput>,
): Promise<ActivityData | null> {
  const nodeSeed = await readNodeSeed(input.avatarID, input.scopeID);

  if (nodeSeed === undefined || nodeSeed.head === undefined) {
    return null;
  }

  const stamps = await readStartStamps();

  if (stamps === undefined) {
    return null;
  }

  const simVersion = context.getBundledEngineHash();

  if (simVersion === undefined) {
    return null;
  }

  const startHash = buildStartHash({
    contentVersion: nodeSeed.contentVersion,
    encounterNode: nodeSeed.encounterNode,
    keyVersion: stamps.keyVersion,
    seed: nodeSeed.head.nextSeed,
    simVersion,
  });

  const now = new Date();

  return {
    appendedAt: null,
    appendedHead: 0,
    avatarID: input.avatarID,
    buildSnapshot: buildOptimisticBuildSnapshot(context, input.avatarID),
    contentVersion: nodeSeed.contentVersion,
    createdAt: now,
    encounterNode: nodeSeed.encounterNode,
    id: `act_${createId()}`,
    keyVersion: stamps.keyVersion,
    lastHash: startHash,
    scopeID: input.scopeID,
    scopeType: input.scopeType,
    secretRef: stamps.secretRef,
    secretVersion: stamps.secretVersion,
    seed: nodeSeed.head.nextSeed,
    simVersion,
    startChainIndex: nodeSeed.head.chainIndex,
    startHash,
    startKey: input.startKey,
    startedAt: now,
    status: 'active',
    stoppedAt: null,
    updatedAt: now,
    verifiedAt: null,
    verifiedHead: 0,
  };
}

/**
 * The client's own optimistic prediction of the avatar's total xp: the last activity this worker
 * installed for the avatar is the only source it can fold from without a network round trip, so a
 * fresh avatar (or a switch to one this worker has no history for) starts at zero. Genuinely
 * unsettled sources beyond that baseline are folded in as they become locally knowable; today
 * there are none to add, so the fold is a pass-through.
 */
function buildOptimisticBuildSnapshot(
  context: WorkerContext,
  avatarID: string,
): { level: number; xp: number } {
  const lastActivity = context.getActivity();

  const settledXP =
    lastActivity !== null && lastActivity.avatarID === avatarID ? lastActivity.buildSnapshot.xp : 0;

  const optimistic = foldOptimisticBuild(settledXP, []);

  return { level: buildLevelFromXP(optimistic.totalXP), xp: optimistic.totalXP };
}
