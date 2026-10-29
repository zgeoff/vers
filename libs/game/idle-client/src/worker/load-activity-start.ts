import { createId } from '@paralleldrive/cuid2';
import type { ActivityData } from '@vers/contract-activity';
import { buildStartHash } from '@vers/contract-activity';
import { readNextPredecessorID } from '../submission/read-next-predecessor-id';
import { readNodeSeed } from '../submission/read-node-seed';
import { readStartStamps } from '../submission/read-start-stamps';
import { buildOptimisticBuildSnapshot } from './build-optimistic-build-snapshot';
import type { WorkerContext } from './types';

interface LoadActivityStartInput {
  readonly avatarID: string;

  readonly predecessorActivityID?: string | undefined;

  readonly scopeID: string;
  readonly scopeType: string;
  readonly startKey: string;
}

export async function loadActivityStart(
  context: WorkerContext,
  input: Readonly<LoadActivityStartInput>,
): Promise<ActivityData | null> {
  const nodeSeed = await readNodeSeed(input.avatarID, input.scopeID);

  if (nodeSeed === undefined) {
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

  const buildSnapshot = buildOptimisticBuildSnapshot(context, input.avatarID);

  const trackedPredecessorID = await readNextPredecessorID(input.avatarID);

  const predecessorActivityID = input.predecessorActivityID ?? trackedPredecessorID;

  const startHash = buildStartHash({
    contentVersion: nodeSeed.contentVersion,
    encounterNode: nodeSeed.encounterNode,
    keyVersion: stamps.keyVersion,
    seed: nodeSeed.anchor.nextSeed,
    simVersion,
  });

  const now = new Date();

  return {
    appendedAt: null,
    appendedHead: 0,
    avatarID: input.avatarID,
    buildSnapshot,
    contentVersion: nodeSeed.contentVersion,
    createdAt: now,
    encounterNode: nodeSeed.encounterNode,
    id: `act_${createId()}`,
    keyVersion: stamps.keyVersion,
    lastHash: startHash,
    playedAt: now,
    predecessorActivityID,
    scopeID: input.scopeID,
    scopeType: input.scopeType,
    secretRef: stamps.secretRef,
    secretVersion: stamps.secretVersion,
    seed: nodeSeed.anchor.nextSeed,
    simVersion,
    startChainIndex: nodeSeed.anchor.chainIndex,
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
