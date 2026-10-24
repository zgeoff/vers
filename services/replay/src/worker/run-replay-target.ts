import { isDefinedError } from '@orpc/client';
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
import { recordBackoff } from '../metrics/record-backoff';
import type { BackoffReason } from '../metrics/record-backoff';
import { recordCacheLookup } from '../metrics/record-cache-lookup';
import type { CacheLookupOutcome } from '../metrics/record-cache-lookup';
import { recordIterationFailure } from '../metrics/record-iteration-failure';
import { recordRejection } from '../metrics/record-rejection';
import type { RejectionReason } from '../metrics/record-rejection';
import { recordSettledXP } from '../metrics/record-settled-xp';
import { recordVerificationLag } from '../metrics/record-verification-lag';
import { readAvatarRollKey } from '../mint/read-avatar-roll-key';
import { rollRewardItems } from '../mint/roll-reward-items';
import { updateReplayAttempts } from '../queue/update-replay-attempts';
import { updateReplayBackoff } from '../queue/update-replay-backoff';
import { buildSegmentDuration } from '../replay/build-segment-duration';
import { compareReplaySegment } from '../replay/compare-replay-segment';
import type { ReplayCache } from '../replay/create-replay-cache';
import { findDescriptorDivergence } from '../replay/find-descriptor-divergence';
import { findSeedDivergence } from '../replay/find-seed-divergence';
import { isForwardExited } from '../replay/is-forward-exited';
import { loadReplaySegment } from '../replay/load-replay-segment';
import { toWireReplaySegmentInput } from '../replay/to-wire-replay-segment-input';
import type {
  CompareVerdict,
  ReplaySegment,
  ReplayedCheckpoint,
  RewardFact,
} from '../replay/types';
import type { MintedItem, ReplayTarget } from '../types';
import { rejectActivity } from './reject-activity';
import type {
  ParkReason,
  PendingCacheEffect,
  ReplayIterationOutcome,
  ReplayWorkerDeps,
} from './types';
import { updateVerifiedAnchorFromPredecessor } from './update-verified-anchor-from-predecessor';

const NEVER_ABORTED = new AbortController().signal;

interface ReplayTargetContext {
  readonly trx: Transaction<DB>;
  readonly deps: Readonly<ReplayWorkerDeps>;
  readonly cache: ReplayCache;
}

export async function runReplayTarget(
  context: ReplayTargetContext,
  target: Readonly<ReplayTarget>,
  deadline: AbortSignal = NEVER_ABORTED,
): Promise<ReplayIterationOutcome> {
  const trx = context.trx;
  const deps = context.deps;

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
    return rejectSegment(context, segment, seedDivergence, 'seed-validation-failed');
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
        return rejectBuildMismatch(context, segment);
      }
    }

    const scopeSecret = await tryReadScopeSecret(deps, segment, deadline);

    if (scopeSecret === undefined) {
      return scheduleReplayRetry(context, segment, 'keys-unavailable');
    }

    const descriptorDivergence = findDescriptorDivergence({
      content: document.encounter,
      scopeID: segment.activity.scopeID,
      scopeSecret,
      stampedEncounterNode: segment.activity.encounterNode,
      userSeed: avatarState.seed,
    });

    if (descriptorDivergence !== undefined) {
      return rejectSegment(context, segment, descriptorDivergence, 'descriptor-validation-failed');
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
        return rejectUnreachableNode(context, segment);
      }
    }
  }

  if (segment.activity.simVersion === deps.simVersion) {
    return runReplayTargetInProcess(context, segment, document, deadline);
  }

  return runReplayTargetCrossVersion(context, segment, document, deadline);
}

type RejectionCause =
  | 'confirmed-on-fresh-replay'
  | 'descriptor-validation-failed'
  | 'seed-validation-failed';

async function rejectSegment(
  context: ReplayTargetContext,
  segment: Readonly<ReplaySegment>,
  divergence: Extract<CompareVerdict, { kind: 'divergence' }>,
  cause: RejectionCause,
): Promise<ReplayIterationOutcome> {
  context.deps.logger.error(
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

  await rejectActivity(context.trx, {
    activityID: segment.activity.id,
    avatarID: segment.activity.avatarID,
    scopeID: segment.activity.scopeID,
    scopeType: segment.activity.scopeType,
  });

  context.cache.remove(segment.activity.id);

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

async function rejectBuildMismatch(
  context: ReplayTargetContext,
  segment: Readonly<ReplaySegment>,
): Promise<ReplayIterationOutcome> {
  context.deps.logger.error(
    {
      activityID: segment.activity.id,
      appendedHead: segment.activity.appendedHead,
      buildSnapshotXP: segment.activity.buildSnapshot.xp,
      verifiedHead: segment.verifiedHead,
    },
    'pinned build does not match the settled xp total; rejecting activity',
  );

  recordRejection('build-mismatch');

  await rejectActivity(context.trx, {
    activityID: segment.activity.id,
    avatarID: segment.activity.avatarID,
    scopeID: segment.activity.scopeID,
    scopeType: segment.activity.scopeType,
  });

  context.cache.remove(segment.activity.id);

  return { kind: 'rejected' };
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

async function scheduleReplayRetry(
  context: ReplayTargetContext,
  segment: Readonly<ReplaySegment>,
  reason: Extract<BackoffReason, 'keys-unavailable' | 'provider-unavailable'>,
): Promise<ReplayIterationOutcome> {
  const backoff = await updateReplayBackoff(context.trx, {
    activityID: segment.activity.id,
    verifiedHead: segment.verifiedHead,
  });

  context.deps.logger.warn(
    {
      activityID: segment.activity.id,
      appendedHead: segment.activity.appendedHead,
      reason,
      simVersion: segment.activity.simVersion,
      verifiedHead: segment.verifiedHead,
      ...backoff,
    },
    'replay dependency unavailable; backing the activity off',
  );

  recordBackoff(reason);

  context.cache.remove(segment.activity.id);

  return { kind: 'backedOff', reason };
}

async function rejectUnreachableNode(
  context: ReplayTargetContext,
  segment: Readonly<ReplaySegment>,
): Promise<ReplayIterationOutcome> {
  context.deps.logger.error(
    {
      activityID: segment.activity.id,
      appendedHead: segment.activity.appendedHead,
      scopeID: segment.activity.scopeID,
      verifiedHead: segment.verifiedHead,
    },
    'replay node reachability check failed; rejecting activity',
  );

  recordRejection('node-unreachable');

  await rejectActivity(context.trx, {
    activityID: segment.activity.id,
    avatarID: segment.activity.avatarID,
    scopeID: segment.activity.scopeID,
    scopeType: segment.activity.scopeType,
  });

  context.cache.remove(segment.activity.id);

  return { kind: 'rejected' };
}

async function runReplayTargetInProcess(
  context: ReplayTargetContext,
  segment: Readonly<ReplaySegment>,
  document: Readonly<ContentDocument>,
  deadline: AbortSignal,
): Promise<ReplayIterationOutcome> {
  const cache = context.cache;
  const unverified = segment.unverifiedCheckpoints;
  const rawCached = cache.get(segment.activity.id);
  const cacheIsCurrent = rawCached !== undefined && isCacheCurrent(rawCached, segment);

  recordCacheLookup(pickCacheLookupOutcome(rawCached, cacheIsCurrent));

  const cached = cacheIsCurrent ? rawCached : undefined;

  if (rawCached !== undefined && cached === undefined) {
    cache.remove(segment.activity.id);
  }

  const compareContext = buildCompareContext(segment);
  const driver = cached?.driver ?? buildFreshDriver(document.encounter, segment);
  const stopAtState = getStopAtState(segment.unverifiedCheckpoints);

  const duration = buildSegmentDuration(
    segment.activity.appendedTimeMs,
    segment.activity.appendedHead,
  );

  const expectedCheckpointCount =
    cached === undefined ? segment.activity.appendedHead : unverified.length;

  const advance = await driver.advanceToDuration(duration, stopAtState, expectedCheckpointCount);

  deadline.throwIfAborted();

  const replayed =
    cached === undefined ? advance.checkpoints.slice(segment.verifiedHead) : advance.checkpoints;

  // A duration-cap trip on this (possibly cached) attempt isn't conclusive — a stale cache entry
  // can produce one too — so it falls through to the same fresh, full-segment confirmation a
  // compare divergence gets, rather than parking on an attempt that never finished comparing.
  const verdict = advance.haltedOnDurationCap
    ? undefined
    : compareReplaySegment(unverified, replayed, compareContext);

  if (verdict?.kind === 'match') {
    return applyMatch(context, segment, { deadline, document, driver, replayed, verdict });
  }

  const confirmDriver = buildFreshDriver(document.encounter, segment);

  const confirmAdvance = await confirmDriver.advanceToDuration(
    duration,
    stopAtState,
    segment.activity.appendedHead,
  );

  deadline.throwIfAborted();

  if (confirmAdvance.haltedOnDurationCap) {
    return parkReplayTarget(context, segment, 'durationCapExceeded');
  }

  const confirmReplayed = confirmAdvance.checkpoints.slice(segment.verifiedHead);
  const confirmVerdict = compareReplaySegment(unverified, confirmReplayed, compareContext);

  if (confirmVerdict.kind === 'match') {
    cache.remove(segment.activity.id);

    return countFailedAttempt(context.trx, context.deps, segment);
  }

  return rejectSegment(context, segment, confirmVerdict, 'confirmed-on-fresh-replay');
}

function isCacheCurrent(
  entry: Readonly<{ emittedCount: number; lastHash: string }>,
  segment: Readonly<ReplaySegment>,
): boolean {
  return entry.emittedCount === segment.verifiedHead && entry.lastHash === segment.prevHash;
}

function pickCacheLookupOutcome(
  rawCached: Readonly<{ emittedCount: number; lastHash: string }> | undefined,
  cacheIsCurrent: boolean,
): CacheLookupOutcome {
  if (rawCached === undefined) {
    return 'miss';
  }

  return cacheIsCurrent ? 'hit' : 'stale';
}

function buildCompareContext(segment: Readonly<ReplaySegment>) {
  return {
    prevHash: segment.prevHash,
    seed: segment.seed,
    startChainIndex: segment.activity.startChainIndex,
  };
}

function buildFreshDriver(
  content: Readonly<EncounterContent>,
  segment: Readonly<ReplaySegment>,
): SimulationDriver {
  const input = buildSimulationInput(content, segment.activity);

  return createSimulationDriver(input.activity, input.avatar);
}

interface NextSeedCheckpoint {
  readonly payload: { readonly nextSeed: string };
}

// the last checkpoint's `nextSeed` is the driver's stop-at sanity check: a checkpoint's `time`
// resets on every engine restart within a farmed stream, so it can never size a duration to
// advance to
function getStopAtState(checkpoints: ReadonlyArray<NextSeedCheckpoint>): string {
  const last = checkpoints.at(-1);

  invariant(last !== undefined, 'a replayed run always has at least one checkpoint');

  return last.payload.nextSeed;
}

interface ReplayMatch {
  readonly deadline: AbortSignal;
  readonly document: Readonly<ContentDocument>;
  readonly driver: SimulationDriver | undefined;
  readonly replayed: ReadonlyArray<ReplayedCheckpoint>;
  readonly verdict: Extract<CompareVerdict, { kind: 'match' }>;
}

async function applyMatch(
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

// only the key read can be unavailable: a fault inside the roll itself is a bug and propagates
interface TryRollRewardItemsOptions {
  readonly deadline: AbortSignal;
  readonly deps: Readonly<ReplayWorkerDeps>;
  readonly document: Readonly<ContentDocument>;
  readonly rewardFacts: ReadonlyArray<RewardFact>;
  readonly segment: Readonly<ReplaySegment>;
}

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

async function parkReplayTarget(
  context: ReplayTargetContext,
  segment: Readonly<ReplaySegment>,
  reason: ParkReason,
): Promise<ReplayIterationOutcome> {
  const message = pickParkMessage(reason);

  context.deps.logger.warn(
    {
      activityID: segment.activity.id,
      appendedHead: segment.activity.appendedHead,
      appendedTimeMs: segment.activity.appendedTimeMs,
      checkpointCount: segment.activity.appendedHead,
      reason,
      simVersion: segment.activity.simVersion,
      verifiedHead: segment.verifiedHead,
    },
    message,
  );

  recordRejection(pickParkRejectionReason(reason));

  await parkActivity(context.trx, segment.activity.id);

  context.cache.remove(segment.activity.id);

  return { kind: 'parked', reason };
}

function pickParkMessage(reason: ParkReason): string {
  if (reason === 'expired') {
    return 'sim version retention expired; parking activity for operator resolution';
  }

  if (reason === 'unknownVersion') {
    return 'sim version unrecognized; parking activity';
  }

  return 'replay duration cap exhausted before the expected checkpoint count; parking activity for operator resolution';
}

function pickParkRejectionReason(reason: ParkReason): RejectionReason {
  return reason === 'durationCapExceeded' ? 'elapsed-time' : 'version-park';
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

async function runReplayTargetCrossVersion(
  context: ReplayTargetContext,
  segment: Readonly<ReplaySegment>,
  document: Readonly<ContentDocument>,
  deadline: AbortSignal,
): Promise<ReplayIterationOutcome> {
  const unverified = segment.unverifiedCheckpoints;
  const job = buildCrossVersionJob(document.encounter, segment);

  const runDeps = {
    db: context.trx,
    privateKey: context.deps.privateKey,
    signal: deadline,
    simVersion: context.deps.simVersion,
  };

  const outcome = await runReplaySegment(runDeps, job);

  deadline.throwIfAborted();

  if (outcome.kind === 'providerUnavailable') {
    return scheduleReplayRetry(context, segment, 'provider-unavailable');
  }

  if (outcome.kind !== 'replayed') {
    return parkReplayTarget(context, segment, outcome.kind);
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
    return applyMatch(context, segment, {
      deadline,
      document,
      driver: undefined,
      replayed,
      verdict,
    });
  }

  const confirmOutcome = await runReplaySegment(runDeps, job);

  deadline.throwIfAborted();

  if (confirmOutcome.kind === 'providerUnavailable') {
    return scheduleReplayRetry(context, segment, 'provider-unavailable');
  }

  if (confirmOutcome.kind !== 'replayed') {
    return parkReplayTarget(context, segment, confirmOutcome.kind);
  }

  if (confirmOutcome.output.haltedOnDurationCap === true) {
    return parkReplayTarget(context, segment, 'durationCapExceeded');
  }

  const confirmReplayed = confirmOutcome.output.checkpoints.slice(segment.verifiedHead);
  const confirmVerdict = compareReplaySegment(unverified, confirmReplayed, compareContext);

  if (confirmVerdict.kind === 'match') {
    return countFailedAttempt(context.trx, context.deps, segment);
  }

  return rejectSegment(context, segment, confirmVerdict, 'confirmed-on-fresh-replay');
}

function buildCrossVersionJob(
  content: Readonly<EncounterContent>,
  segment: Readonly<ReplaySegment>,
) {
  const input = buildSimulationInput(content, segment.activity);
  const stopAtState = getStopAtState(segment.unverifiedCheckpoints);

  const duration = buildSegmentDuration(
    segment.activity.appendedTimeMs,
    segment.activity.appendedHead,
  );

  return toWireReplaySegmentInput({
    activity: input.activity,
    avatar: input.avatar,
    duration,
    simVersion: segment.activity.simVersion,
    stopAtState,
    expectedCheckpointCount: segment.activity.appendedHead,
  });
}
