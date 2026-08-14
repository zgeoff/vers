import { createId } from '@paralleldrive/cuid2';
import type { ActivityData } from '@vers/contract-activity';
import { buildStartHash } from '@vers/contract-activity';
import { buildLevelFromXP } from '@vers/idle-core';
import { findCachedContentDocument } from '../content/find-cached-content-document';
import { readNodeSeed } from '../submission/read-node-seed';
import { readStartStamps } from '../submission/read-start-stamps';
import type { WorkerContext } from './types';

interface BuildOfflineStartRowInput {
  readonly avatarID: string;
  readonly scopeID: string;
  readonly scopeType: string;
  readonly startKey: string;
}

/**
 * Synthesizes a full `ActivityData` root row for an offline-open start, entirely from this
 * device's cached start inputs — `null` when any of them is missing, since no local start is
 * possible without every one: the scope's cached genesis seed and encounter (never revealed on
 * this device, or revealed for a different avatar), the scope's content document (cached only
 * once an activity has installed at that content version on this device), the account's cached
 * crypto stamps, or the build's bundled engine hash (undefined in dev builds, which start against
 * the registry's current stamp instead — unavailable offline). `buildSnapshot` is a settled-xp
 * guess sourced from the last activity row this worker installed for the avatar, `{ level: 1, xp:
 * 0 }` when it holds none — a deliberate hint the server reconcile re-authors, never an attempt to
 * reproduce the server's optimistic total.
 */
export async function buildOfflineStartRow(
  context: WorkerContext,
  input: Readonly<BuildOfflineStartRowInput>,
): Promise<ActivityData | null> {
  const nodeSeed = await readNodeSeed(input.avatarID, input.scopeID);

  if (nodeSeed === undefined) {
    return null;
  }

  // resolved from cache only: an offline start with an uncached content document has no way to
  // install, and must fail here rather than let the install's own load reach the network
  if ((await findCachedContentDocument(nodeSeed.contentVersion)) === undefined) {
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
    seed: nodeSeed.genesisSeed,
    simVersion,
  });

  const now = new Date();

  return {
    appendedAt: null,
    appendedHead: 0,
    avatarID: input.avatarID,
    buildSnapshot: buildOfflineBuildSnapshot(context, input.avatarID),
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
    seed: nodeSeed.genesisSeed,
    simVersion,
    startChainIndex: 0,
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

function buildOfflineBuildSnapshot(
  context: WorkerContext,
  avatarID: string,
): { level: number; xp: number } {
  const lastActivity = context.getActivity();

  if (lastActivity !== null && lastActivity.avatarID === avatarID) {
    return lastActivity.buildSnapshot;
  }

  return { level: buildLevelFromXP(0), xp: 0 };
}
