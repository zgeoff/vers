import type { ContentDocument } from '@vers/contract-activity';
import { SecretRefSchema } from '@vers/contract-keys';
import type { DB } from '@vers/db';
import type { EncounterContent } from '@vers/game-utils';
import type { SimulationDriver } from '@vers/idle-core';
import { buildLevelFromXP, buildSimulationInput } from '@vers/idle-core';
import { createSimulationDriver } from '@vers/idle-core/replay';
import { readScopeSecret } from '@vers/worldmap-content';
import { ORIGIN_CELL, isNodeSelectable, toNodeID } from '@vers/worldmap-core';
import type { Transaction } from 'kysely';
import invariant from 'tiny-invariant';
import { applyVerifiedSegment } from '../apply/apply-verified-segment';
import { parkActivity } from '../dispatch/park-activity';
import { runReplaySegment } from '../dispatch/run-replay-segment';
import { recordIterationFailure } from '../metrics/record-iteration-failure';
import { recordRejection } from '../metrics/record-rejection';
import type { RejectionReason } from '../metrics/record-rejection';
import { recordSettledXP } from '../metrics/record-settled-xp';
import { recordVerificationLag } from '../metrics/record-verification-lag';
import { rollRewardItems } from '../mint/roll-reward-items';
import { updateReplayAttempts } from '../queue/update-replay-attempts';
import { buildSegmentDuration } from '../replay/build-segment-duration';
import { compareReplaySegment } from '../replay/compare-replay-segment';
import type { ReplayCache } from '../replay/create-replay-cache';
import { findDescriptorDivergence } from '../replay/find-descriptor-divergence';
import { findSeedDivergence } from '../replay/find-seed-divergence';
import { isForwardExited } from '../replay/is-forward-exited';
import { loadReplaySegment } from '../replay/load-replay-segment';
import { toWireReplaySegmentInput } from '../replay/to-wire-replay-segment-input';
import type { CompareVerdict, ReplaySegment, ReplayedCheckpoint } from '../replay/types';
import type { ReplayFrontier } from '../types';
import { rejectActivity } from './reject-activity';
import type { PendingCacheEffect, ReplayIterationOutcome, ReplayWorkerDeps } from './types';
import { updateVerifiedAnchorFromPredecessor } from './update-verified-anchor-from-predecessor';

/**
 * Adjudicates one claimed activity's replay frontier: loads its segment, catches the chain's
 * verified anchor up to a forward-exited predecessor it missed, re-derives the activity's seed on
 * its first verified batch, then dispatches by `simVersion` — the in-process incremental cache for
 * this deploy's own engine, the cross-version provider registry for everything else — and turns the
 * resulting verdict into a cursor-only apply, a confirmed rejection, or a park. By claim time the
 * activity's predecessor is settled or rejected, so the descriptor, reachability, and build checks
 * below read only fully-settled state and are the legality boundary — the claim itself never decides
 * legality, only sequences when each activity's checks run. Runs inside the caller's transaction,
 * alongside the chain claim it composes with.
 */
export async function runFrontier(
  trx: Transaction<DB>,
  deps: Readonly<ReplayWorkerDeps>,
  // oxlint-disable-next-line typescript/prefer-readonly-parameter-types -- a mutable cache handle whose remove/get/set are its whole point; no readonly form is useful
  cache: ReplayCache,
  frontier: Readonly<ReplayFrontier>,
): Promise<ReplayIterationOutcome> {
  const loaded = await loadReplaySegment(trx, frontier);

  if (loaded === undefined) {
    return { kind: 'idle' };
  }

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

    // A build is a pure function of settled xp, so the pinned start build must match the avatar's
    // settled total exactly. This catches a rejected ancestor's xp shortfall: a successor that
    // banked a now-rejected ancestor's optimistic xp stamped a build the settled total never
    // backs.
    //
    // Gated on this activity's own `settledXP` reading zero, not on the frontier's `verifiedHead`:
    // a stale duplicate redelivery can still carry a stale `verifiedHead` of 0, but its
    // `settledXP` already reflects the earlier apply, so the check runs at most once, on the
    // genuine first pass.
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

    const scopeSecret = await readScopeSecret(
      {
        issuer: 'service-replay',
        keysServiceURL: deps.keysServiceURL,
        privateKey: deps.privateKey,
      },
      {
        avatarID: segment.activity.avatarID,
        secretRef: SecretRefSchema.parse(segment.activity.secretRef),
        secretVersion: segment.activity.secretVersion,
      },
    );

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

    // Reachability is validated once at a run's first verified pass, against the frontier its
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
    return runFrontierInProcess(trx, deps, cache, segment, document);
  }

  return runFrontierCrossVersion(trx, deps, cache, segment, document);
}

interface NextSeedCheckpoint {
  readonly payload: { readonly nextSeed: string };
}

/**
 * The last checkpoint in a stored run's `nextSeed` — the driver's `stopAtState` sanity check. A
 * checkpoint's own `time` resets on every engine restart within a farmed stream, so it can never
 * size a duration to advance to; `rngState` runs forward monotonically across restarts instead.
 * The segment's own checkpoint count is the driver's primary halt; this is only an early exit.
 */
function findStopAtState(checkpoints: ReadonlyArray<NextSeedCheckpoint>): string {
  const last = checkpoints.at(-1);

  invariant(last !== undefined, 'a replayed run always has at least one checkpoint');

  return last.payload.nextSeed;
}

/**
 * A cached driver is a valid resume point only when it sits exactly where the freshly loaded
 * segment says verification left off — its emitted count matches `verifiedHead` and its hash
 * matches the segment's own predecessor hash. Anything else (a stale entry left behind by a
 * concurrent adjudication, or simple drift) is discarded rather than trusted.
 */
function isCacheCurrent(
  entry: Readonly<{ emittedCount: number; lastHash: string }>,
  segment: Readonly<ReplaySegment>,
): boolean {
  return entry.emittedCount === segment.verifiedHead && entry.lastHash === segment.prevHash;
}

async function runFrontierInProcess(
  trx: Transaction<DB>,
  deps: Readonly<ReplayWorkerDeps>,
  // oxlint-disable-next-line typescript/prefer-readonly-parameter-types -- a mutable cache handle whose remove/get/set are its whole point; no readonly form is useful
  cache: ReplayCache,
  segment: Readonly<ReplaySegment>,
  document: Readonly<ContentDocument>,
): Promise<ReplayIterationOutcome> {
  const unverified = segment.checkpoints.slice(segment.verifiedHead);
  const rawCached = cache.get(segment.activity.id);

  const cached =
    rawCached !== undefined && isCacheCurrent(rawCached, segment) ? rawCached : undefined;

  if (rawCached !== undefined && cached === undefined) {
    cache.remove(segment.activity.id);
  }

  const compareContext = buildCompareContext(segment);
  const driver = cached?.driver ?? buildFreshDriver(document.encounter, segment);
  const stopAtState = findStopAtState(segment.checkpoints);

  const duration = buildSegmentDuration(
    segment.activity.appendedTimeMs,
    segment.checkpoints.length,
  );

  const expectedCheckpointCount =
    cached === undefined ? segment.checkpoints.length : unverified.length;

  const advance = await driver.advanceToDuration(duration, stopAtState, expectedCheckpointCount);

  const replayed =
    cached === undefined ? advance.checkpoints.slice(segment.verifiedHead) : advance.checkpoints;

  // A duration-cap trip on this (possibly cached) attempt isn't conclusive — a stale cache entry
  // can produce one too — so it falls through to the same fresh, full-segment confirmation a
  // compare divergence gets, rather than parking on an attempt that never finished comparing.
  const verdict = advance.haltedOnDurationCap
    ? undefined
    : compareReplaySegment(unverified, replayed, compareContext);

  if (verdict?.kind === 'match') {
    return applyMatch(trx, deps, segment, replayed, driver, verdict, document);
  }

  const confirmDriver = buildFreshDriver(document.encounter, segment);

  const confirmAdvance = await confirmDriver.advanceToDuration(
    duration,
    stopAtState,
    segment.checkpoints.length,
  );

  if (confirmAdvance.haltedOnDurationCap) {
    return parkFrontier(trx, deps, cache, segment, 'durationCapExceeded');
  }

  const confirmReplayed = confirmAdvance.checkpoints.slice(segment.verifiedHead);
  const confirmVerdict = compareReplaySegment(unverified, confirmReplayed, compareContext);

  if (confirmVerdict.kind === 'match') {
    cache.remove(segment.activity.id);

    return countFailedAttempt(trx, deps, segment);
  }

  return rejectSegment(trx, deps, cache, segment, confirmVerdict, 'confirmed-on-fresh-replay');
}

async function runFrontierCrossVersion(
  trx: Transaction<DB>,
  deps: Readonly<ReplayWorkerDeps>,
  // oxlint-disable-next-line typescript/prefer-readonly-parameter-types -- a mutable cache handle whose remove/get/set are its whole point; no readonly form is useful
  cache: ReplayCache,
  segment: Readonly<ReplaySegment>,
  document: Readonly<ContentDocument>,
): Promise<ReplayIterationOutcome> {
  const unverified = segment.checkpoints.slice(segment.verifiedHead);
  const job = buildCrossVersionJob(document.encounter, segment);
  const runDeps = { db: trx, privateKey: deps.privateKey, simVersion: deps.simVersion };

  const outcome = await runReplaySegment(runDeps, job);

  if (outcome.kind !== 'replayed') {
    return parkFrontier(trx, deps, cache, segment, outcome.kind);
  }

  const compareContext = buildCompareContext(segment);
  const replayed = outcome.output.checkpoints.slice(segment.verifiedHead);

  // As in the in-process path, a duration-cap trip on this first attempt isn't conclusive on its
  // own — it falls through to the same fresh confirmation dispatch a compare divergence gets.
  const verdict =
    outcome.output.haltedOnDurationCap === true
      ? undefined
      : compareReplaySegment(unverified, replayed, compareContext);

  if (verdict?.kind === 'match') {
    return applyMatch(trx, deps, segment, replayed, undefined, verdict, document);
  }

  const confirmOutcome = await runReplaySegment(runDeps, job);

  if (confirmOutcome.kind !== 'replayed') {
    return parkFrontier(trx, deps, cache, segment, confirmOutcome.kind);
  }

  if (confirmOutcome.output.haltedOnDurationCap === true) {
    return parkFrontier(trx, deps, cache, segment, 'durationCapExceeded');
  }

  const confirmReplayed = confirmOutcome.output.checkpoints.slice(segment.verifiedHead);
  const confirmVerdict = compareReplaySegment(unverified, confirmReplayed, compareContext);

  if (confirmVerdict.kind === 'match') {
    return countFailedAttempt(trx, deps, segment);
  }

  return rejectSegment(trx, deps, cache, segment, confirmVerdict, 'confirmed-on-fresh-replay');
}

/**
 * Settles a matched segment against the activity's running total. A terminal checkpoint carries
 * the run's final xp rather than its own delta, so it pays only the part no earlier segment
 * settled and leaves the total sitting at that final figure; every other segment pays the deltas
 * it verified and adds them on. The two are alternatives — a terminal total already contains the
 * deltas — so a segment holding both settles once, through the terminal.
 */
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

async function applyMatch(
  trx: Transaction<DB>,
  deps: Readonly<ReplayWorkerDeps>,
  segment: Readonly<ReplaySegment>,
  replayed: ReadonlyArray<ReplayedCheckpoint>,
  driver: SimulationDriver | undefined,
  verdict: Extract<CompareVerdict, { kind: 'match' }>,
  document: Readonly<ContentDocument>,
): Promise<ReplayIterationOutcome> {
  const rewardFacts = verdict.rewardFacts;
  const settlement = buildSettlement(segment.activity.settledXP, verdict);
  const lastReplayed = replayed.at(-1);
  const lastStored = segment.checkpoints.at(-1);

  invariant(
    lastReplayed !== undefined && lastStored !== undefined,
    'a compared segment always has at least one checkpoint',
  );

  const forwardExited = isForwardExited(lastReplayed.type, segment.activity.status);
  const advanceChain = forwardExited && lastStored.version === segment.activity.appendedHead;

  // A first clear is a verified completed terminal on a map node; a fail, stop, or cap forward-
  // exits the chain without clearing it, and a non-`world_map_node` scope has no completion
  // frontier.
  const clearedNodeID =
    lastReplayed.type === 'completed' && segment.activity.scopeType === 'world_map_node'
      ? segment.activity.scopeID
      : undefined;

  const items = await rollRewardItems(
    { keysServiceURL: deps.keysServiceURL, privateKey: deps.privateKey },
    {
      avatarID: segment.activity.avatarID,
      keyVersion: segment.activity.keyVersion,
      rewardFacts,
      scopeID: segment.activity.scopeID,
      scopeType: segment.activity.scopeType,
      tables: document.loot,
    },
  );

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

    for (const checkpoint of segment.checkpoints.slice(segment.verifiedHead, lastStored.version)) {
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

type RejectionCause =
  | 'confirmed-on-fresh-replay'
  | 'descriptor-validation-failed'
  | 'seed-validation-failed';

async function rejectSegment(
  trx: Transaction<DB>,
  deps: Readonly<ReplayWorkerDeps>,
  // oxlint-disable-next-line typescript/prefer-readonly-parameter-types -- a mutable cache handle whose remove/get/set are its whole point; no readonly form is useful
  cache: ReplayCache,
  segment: Readonly<ReplaySegment>,
  divergence: Extract<CompareVerdict, { kind: 'divergence' }>,
  cause: RejectionCause,
): Promise<ReplayIterationOutcome> {
  deps.logger.error(
    {
      activityID: segment.activity.id,
      appendedHead: segment.activity.appendedHead,
      reason: divergence.reason,
      simVersion: segment.activity.simVersion,
      verifiedHead: segment.verifiedHead,
      version: divergence.version,
    },
    pickRejectMessage(cause),
  );

  const rejectionReason: RejectionReason =
    cause === 'descriptor-validation-failed' ? 'descriptor-mismatch' : 'integrity-mismatch';

  recordRejection(rejectionReason);

  await rejectActivity(trx, {
    activityID: segment.activity.id,
    avatarID: segment.activity.avatarID,
    scopeID: segment.activity.scopeID,
    scopeType: segment.activity.scopeType,
  });

  cache.remove(segment.activity.id);

  return { kind: 'rejected' };
}

function pickRejectMessage(cause: RejectionCause): string {
  if (cause === 'seed-validation-failed') {
    return 'replay seed validation failed; rejecting activity';
  }

  if (cause === 'descriptor-validation-failed') {
    return 'replay descriptor validation failed; rejecting activity';
  }

  return 'replay divergence confirmed on a fresh replay; rejecting activity';
}

/**
 * Refuses an activity whose pinned start build does not match the avatar's settled xp total. By
 * claim time this activity's predecessor is settled or rejected, so a mismatch here means the
 * pinned build banked optimistic xp from an ancestor a rejection later erased — there is nothing to
 * replay the stream against and no divergence to confirm, since the rejection follows from the
 * build's own foundation rather than from anything the stream itself did. Rejecting through the
 * same single-chain path voids this activity's own successors, and every activity that banked this
 * one's now-erased xp fails this same check in turn, so the refusal cascades through the whole
 * dependency graph without any writer reaching across chains.
 */
async function rejectBuildMismatch(
  trx: Transaction<DB>,
  deps: Readonly<ReplayWorkerDeps>,
  // oxlint-disable-next-line typescript/prefer-readonly-parameter-types -- a mutable cache handle whose remove/get/set are its whole point; no readonly form is useful
  cache: ReplayCache,
  segment: Readonly<ReplaySegment>,
): Promise<ReplayIterationOutcome> {
  deps.logger.error(
    {
      activityID: segment.activity.id,
      appendedHead: segment.activity.appendedHead,
      buildSnapshotXP: segment.activity.buildSnapshot.xp,
      verifiedHead: segment.verifiedHead,
    },
    'pinned build does not match the settled xp total; rejecting activity',
  );

  recordRejection('build-mismatch');

  await rejectActivity(trx, {
    activityID: segment.activity.id,
    avatarID: segment.activity.avatarID,
    scopeID: segment.activity.scopeID,
    scopeType: segment.activity.scopeType,
  });

  cache.remove(segment.activity.id);

  return { kind: 'rejected' };
}

/**
 * Refuses a `world_map_node` activity whose scope is not connected to the avatar's verified
 * first-clear frontier. Rejecting through the same single-chain path voids this activity's own
 * successors, exactly as the build-mismatch rejection does.
 */
async function rejectUnreachableNode(
  trx: Transaction<DB>,
  deps: Readonly<ReplayWorkerDeps>,
  // oxlint-disable-next-line typescript/prefer-readonly-parameter-types -- a mutable cache handle whose remove/get/set are its whole point; no readonly form is useful
  cache: ReplayCache,
  segment: Readonly<ReplaySegment>,
): Promise<ReplayIterationOutcome> {
  deps.logger.error(
    {
      activityID: segment.activity.id,
      appendedHead: segment.activity.appendedHead,
      scopeID: segment.activity.scopeID,
      verifiedHead: segment.verifiedHead,
    },
    'replay node reachability check failed; rejecting activity',
  );

  recordRejection('node-unreachable');

  await rejectActivity(trx, {
    activityID: segment.activity.id,
    avatarID: segment.activity.avatarID,
    scopeID: segment.activity.scopeID,
    scopeType: segment.activity.scopeType,
  });

  cache.remove(segment.activity.id);

  return { kind: 'rejected' };
}

async function countFailedAttempt(
  trx: Transaction<DB>,
  deps: Readonly<ReplayWorkerDeps>,
  segment: Readonly<ReplaySegment>,
): Promise<ReplayIterationOutcome> {
  const result = await updateReplayAttempts(trx, {
    activityID: segment.activity.id,
  });

  if (result?.quarantined === true) {
    deps.logger.error(
      { activityID: segment.activity.id },
      'replay attempts exhausted; activity quarantined',
    );

    recordIterationFailure('quarantined');

    return { kind: 'quarantined' };
  }

  return { kind: 'unconfirmedDivergence' };
}

async function parkFrontier(
  trx: Transaction<DB>,
  deps: Readonly<ReplayWorkerDeps>,
  // oxlint-disable-next-line typescript/prefer-readonly-parameter-types -- a mutable cache handle whose remove/get/set are its whole point; no readonly form is useful
  cache: ReplayCache,
  segment: Readonly<ReplaySegment>,
  reason: 'durationCapExceeded' | 'expired' | 'providerUnavailable' | 'unknownVersion',
): Promise<ReplayIterationOutcome> {
  const message = pickParkMessage(reason);

  deps.logger.warn(
    {
      activityID: segment.activity.id,
      appendedHead: segment.activity.appendedHead,
      appendedTimeMs: segment.activity.appendedTimeMs,
      checkpointCount: segment.checkpoints.length,
      reason,
      simVersion: segment.activity.simVersion,
      verifiedHead: segment.verifiedHead,
    },
    message,
  );

  recordRejection(pickParkRejectionReason(reason));

  await parkActivity(trx, segment.activity.id);

  cache.remove(segment.activity.id);

  return { kind: 'parked', reason };
}

function pickParkMessage(
  reason: 'durationCapExceeded' | 'expired' | 'providerUnavailable' | 'unknownVersion',
): string {
  if (reason === 'expired') {
    return 'sim version retention expired; parking activity for operator resolution';
  }

  if (reason === 'unknownVersion') {
    return 'sim version unrecognized; parking activity';
  }

  if (reason === 'providerUnavailable') {
    return 'sim version provider unavailable; parking activity until the registry sweep retries it';
  }

  return 'replay duration cap exhausted before the expected checkpoint count; parking activity for operator resolution';
}

function pickParkRejectionReason(
  reason: 'durationCapExceeded' | 'expired' | 'providerUnavailable' | 'unknownVersion',
): RejectionReason {
  if (reason === 'durationCapExceeded') {
    return 'elapsed-time';
  }

  if (reason === 'providerUnavailable') {
    return 'provider-unavailable';
  }

  return 'version-park';
}

function buildFreshDriver(
  content: Readonly<EncounterContent>,
  segment: Readonly<ReplaySegment>,
): SimulationDriver {
  const input = buildSimulationInput(content, segment.activity);

  return createSimulationDriver(input.activity, input.avatar);
}

function buildCrossVersionJob(
  content: Readonly<EncounterContent>,
  segment: Readonly<ReplaySegment>,
) {
  const input = buildSimulationInput(content, segment.activity);
  const stopAtState = findStopAtState(segment.checkpoints);

  const duration = buildSegmentDuration(
    segment.activity.appendedTimeMs,
    segment.checkpoints.length,
  );

  return toWireReplaySegmentInput(
    input.activity,
    input.avatar,
    duration,
    segment.activity.simVersion,
    stopAtState,
    segment.checkpoints.length,
  );
}

function buildCompareContext(segment: Readonly<ReplaySegment>) {
  return {
    prevHash: segment.prevHash,
    seed: segment.seed,
    startChainIndex: segment.activity.startChainIndex,
  };
}
