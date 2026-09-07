import { createId } from '@paralleldrive/cuid2';
import type { ActivityData } from '@vers/contract-activity';
import { buildStartHash } from '@vers/contract-activity';
import type { OptimisticBuildSource } from '@vers/idle-core';
import { buildLevelFromXP, foldOptimisticBuild } from '@vers/idle-core';
import { readLastStartedActivity } from '../submission/read-last-started-activity';
import { readNodeSeed } from '../submission/read-node-seed';
import { readStartStamps } from '../submission/read-start-stamps';
import type { LatestRun, WorkerContext } from './types';

interface BuildActivityStartInput {
  readonly avatarID: string;

  readonly predecessorActivityID?: string | undefined;

  readonly scopeID: string;
  readonly scopeType: string;
  readonly startKey: string;
}

export async function buildActivityStart(
  context: WorkerContext,
  input: Readonly<BuildActivityStartInput>,
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

  const trackedPredecessorID = await readPredecessorActivityID(input.avatarID);

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

async function readPredecessorActivityID(avatarID: string): Promise<null | string> {
  const record = await readLastStartedActivity(avatarID);

  return record?.lastActivityID ?? null;
}

function buildOptimisticBuildSnapshot(
  context: WorkerContext,
  avatarID: string,
): { level: number; xp: number } {
  const latestRun = context.getLatestRun();
  const previousRun = latestRun !== null && latestRun.avatarID === avatarID ? latestRun : null;
  const sources = previousRun === null ? [] : buildPreviousRunSources(previousRun);
  const optimistic = foldOptimisticBuild(previousRun?.baselineXP ?? 0, sources);

  return { level: buildLevelFromXP(optimistic.totalXP), xp: optimistic.totalXP };
}

function buildPreviousRunSources(previousRun: Readonly<LatestRun>): Array<OptimisticBuildSource> {
  if (previousRun.tail === null) {
    return [];
  }

  return [{ settledXP: 0, tailPayload: previousRun.tail, unverifiedDeltaSum: previousRun.deltaXP }];
}
