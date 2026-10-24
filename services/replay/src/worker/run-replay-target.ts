import { isDefinedError } from '@orpc/client';
import { SecretRefSchema } from '@vers/contract-keys';
import type { DB } from '@vers/db';
import { buildLevelFromXP } from '@vers/idle-core';
import { readScopeSecret } from '@vers/worldmap-content';
import { ORIGIN_CELL, isNodeSelectable, toNodeID } from '@vers/worldmap-core';
import type { Transaction } from 'kysely';
import invariant from 'tiny-invariant';
import type { ReplayCache } from '../replay/create-replay-cache';
import { findDescriptorDivergence } from '../replay/find-descriptor-divergence';
import { findSeedDivergence } from '../replay/find-seed-divergence';
import { loadReplaySegment } from '../replay/load-replay-segment';
import type { ReplaySegment } from '../replay/types';
import type { ReplayTarget } from '../types';
import { rejectBuildMismatch } from './reject-build-mismatch';
import { rejectSegment } from './reject-segment';
import { rejectUnreachableNode } from './reject-unreachable-node';
import { runReplayTargetCrossVersion } from './run-replay-target-cross-version';
import { runReplayTargetInProcess } from './run-replay-target-in-process';
import { scheduleReplayRetry } from './schedule-replay-retry';
import type { ReplayIterationOutcome, ReplayWorkerDeps } from './types';
import { updateVerifiedAnchorFromPredecessor } from './update-verified-anchor-from-predecessor';

const NEVER_ABORTED = new AbortController().signal;

export async function runReplayTarget(
  trx: Transaction<DB>,
  deps: Readonly<ReplayWorkerDeps>,
  cache: ReplayCache,
  target: Readonly<ReplayTarget>,
  deadline: AbortSignal = NEVER_ABORTED,
): Promise<ReplayIterationOutcome> {
  const loaded = await loadReplaySegment(trx, target);

  if (loaded === undefined) {
    return { kind: 'idle' };
  }

  deadline.throwIfAborted();

  const document = await deps.loadContentDocument(loaded.activity.contentVersion);

  invariant(document, `unknown content version: ${loaded.activity.contentVersion}`);

  const reconciledAnchor = await updateVerifiedAnchorFromPredecessor(trx, loaded);

  const segment: ReplaySegment =
    reconciledAnchor === undefined
      ? loaded
      : {
          ...loaded,
          chain: {
            ...loaded.chain,
            verifiedChainIndex: reconciledAnchor.chainIndex,
            verifiedNextSeed: reconciledAnchor.nextSeed,
          },
        };

  const seedDivergence = findSeedDivergence(segment);

  if (seedDivergence !== undefined) {
    return rejectSegment(trx, deps, cache, segment, seedDivergence, 'seed-validation-failed');
  }

  // Only a segment's first pass needs the descriptor, build, and reachability checks — a later
  // pass over the same activity has already verified them once, and a stamped row never changes
  // afterward.
  if (segment.verifiedHead === 0) {
    const avatarState = await trx
      .selectFrom('avatars')
      .select(['seed', 'xp'])
      .where('id', '=', segment.activity.avatarID)
      .executeTakeFirst();

    invariant(avatarState !== undefined, 'a stamped activity always has an owning avatar');

    // gated on `settledXP` reading zero, not on `verifiedHead`: a stale duplicate redelivery can
    // still carry a `verifiedHead` of 0, but its `settledXP` already reflects the earlier apply, so
    // the check runs at most once
    if (segment.activity.settledXP === 0) {
      const expectedBuild = {
        level: buildLevelFromXP(avatarState.xp),
        xp: avatarState.xp,
      };

      if (
        expectedBuild.level !== segment.activity.buildSnapshot.level ||
        expectedBuild.xp !== segment.activity.buildSnapshot.xp
      ) {
        return rejectBuildMismatch(trx, deps, cache, segment);
      }
    }

    const scopeSecret = await tryReadScopeSecret(deps, segment, deadline);

    if (scopeSecret === undefined) {
      return scheduleReplayRetry(trx, deps, cache, segment, 'keys-unavailable');
    }

    const descriptorDivergence = findDescriptorDivergence({
      content: document.encounter,
      scopeID: segment.activity.scopeID,
      scopeSecret,
      stampedEncounterNode: segment.activity.encounterNode,
      userSeed: avatarState.seed,
    });

    if (descriptorDivergence !== undefined) {
      return rejectSegment(
        trx,
        deps,
        cache,
        segment,
        descriptorDivergence,
        'descriptor-validation-failed',
      );
    }

    // Reachability is validated once at a run's first verified pass, against the target its
    // predecessors have by then established; a later pass over the same run never re-checks.
    if (
      segment.activity.scopeType === 'world_map_node' &&
      segment.activity.scopeID !== toNodeID(ORIGIN_CELL[0], ORIGIN_CELL[1])
    ) {
      const grants = await trx
        .selectFrom('avatarGrants')
        .select('key')
        .where('avatarId', '=', segment.activity.avatarID)
        .where('kind', '=', 'first_clear')
        .execute();

      const completedNodeIDs = new Set(grants.map((grant) => grant.key));

      if (!isNodeSelectable(avatarState.seed, completedNodeIDs, segment.activity.scopeID)) {
        return rejectUnreachableNode(trx, deps, cache, segment);
      }
    }
  }

  if (segment.activity.simVersion === deps.simVersion) {
    return runReplayTargetInProcess(trx, deps, cache, segment, document, deadline);
  }

  return runReplayTargetCrossVersion(trx, deps, cache, segment, document, deadline);
}

// a keys outage is operational, so it backs the activity off rather than counting against it; a
// defined refusal is a misconfiguration and propagates, and a deadline abort propagates as itself
async function tryReadScopeSecret(
  deps: Readonly<ReplayWorkerDeps>,
  segment: Readonly<ReplaySegment>,
  deadline: AbortSignal,
): Promise<Uint8Array | undefined> {
  try {
    return await readScopeSecret(
      {
        issuer: 'service-replay',
        keysServiceURL: deps.keysServiceURL,
        privateKey: deps.privateKey,
        signal: deadline,
      },
      {
        avatarID: segment.activity.avatarID,
        secretRef: SecretRefSchema.parse(segment.activity.secretRef),
        secretVersion: segment.activity.secretVersion,
      },
    );
  } catch (error) {
    deadline.throwIfAborted();

    if (isDefinedError(error)) {
      throw error;
    }

    return undefined;
  }
}
