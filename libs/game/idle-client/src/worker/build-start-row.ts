import { createId } from '@paralleldrive/cuid2';
import type { ActivityData } from '@vers/contract-activity';
import { buildStartHash } from '@vers/contract-activity';
import type { OptimisticBuildSource } from '@vers/idle-core';
import { buildLevelFromXP, foldOptimisticBuild, parseTerminalCheckpointXP } from '@vers/idle-core';
import * as z from 'zod';
import { readNodeSeed } from '../submission/read-node-seed';
import { readQueuedCheckpoints } from '../submission/read-queued-checkpoints';
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
 * the scope's cached node seed (never revealed on this device, or revealed for a different
 * avatar), the account's cached crypto stamps, or the build's bundled engine hash (undefined in a
 * dev build, which has no local fallback). The chain roots at the node's cached head rather than
 * its genesis, so a revisited node's start continues from where play actually left off.
 * `buildSnapshot` is a client-side optimistic guess — a hint the server re-authors and
 * exact-match-rejects at submission time, never a value this mint depends on for its own
 * correctness.
 */
export async function buildStartRow(
  context: WorkerContext,
  input: Readonly<BuildStartRowInput>,
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

  const buildSnapshot = await buildOptimisticBuildSnapshot(context, input.avatarID);

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
    buildSnapshot,
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
 * The client's own optimistic prediction of the avatar's total xp for a fresh start. The last
 * activity this worker installed for the avatar is the baseline it folds from without a network
 * round trip, so a fresh avatar — or a switch to one this worker has no history for — starts at
 * zero. The just-stopped run's own locally queued checkpoints fold on top of that baseline, so a
 * switch reflects the xp already earned rather than the prior run's stale start snapshot. Sources
 * this worker cannot yet reconstruct — other unsettled runs the server holds but this device never
 * simulated — land with the submission plumbing tracked separately; the snapshot stays a hint the
 * server re-authors regardless.
 */
async function buildOptimisticBuildSnapshot(
  context: WorkerContext,
  avatarID: string,
): Promise<{ level: number; xp: number }> {
  const lastActivity = context.getActivity();

  const previousRun =
    lastActivity !== null && lastActivity.avatarID === avatarID ? lastActivity : null;

  const sources = previousRun === null ? [] : await buildPreviousRunSources(previousRun);
  const optimistic = foldOptimisticBuild(previousRun?.buildSnapshot.xp ?? 0, sources);

  return { level: buildLevelFromXP(optimistic.totalXP), xp: optimistic.totalXP };
}

/**
 * Folds the previous run's locally queued checkpoints into the single optimistic source a switch
 * borrows from: a terminal tail carries the run's final total, and the summed per-checkpoint deltas
 * carry a non-terminal run's xp earned past its own start baseline. An empty queue — a run that has
 * submitted nothing locally — contributes no source, leaving the baseline unchanged.
 */
async function buildPreviousRunSources(
  activity: Readonly<ActivityData>,
): Promise<Array<OptimisticBuildSource>> {
  const queued = await readQueuedCheckpoints(activity.id);

  const tail = queued.at(-1);

  if (tail === undefined) {
    return [];
  }

  const unverifiedDeltaSum = queued.reduce(
    (sum, entry) =>
      parseTerminalCheckpointXP(entry.payload) === undefined
        ? sum + parseCheckpointXP(entry.payload)
        : sum,
    0,
  );

  return [{ id: activity.id, settledXP: 0, tailPayload: tail.payload, unverifiedDeltaSum }];
}

const CheckpointXPSchema = z.object({ rewards: z.object({ xp: z.number() }) });

/**
 * The `rewards.xp` a queued checkpoint's untrusted payload carries, zero when it declares none —
 * appended data is untrusted, so a payload missing the field contributes nothing rather than
 * throwing.
 */
function parseCheckpointXP(payload: unknown): number {
  const parsed = CheckpointXPSchema.safeParse(payload);

  return parsed.success ? parsed.data.rewards.xp : 0;
}
