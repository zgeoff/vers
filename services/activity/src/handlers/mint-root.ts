import type { BuildSnapshot, OfflineRootSubmission } from '@vers/contract-activity';
import { buildStartHash } from '@vers/contract-activity';
import type { Activities, DB } from '@vers/db';
import { buildLevelFromXP } from '@vers/idle-core';
import { ORIGIN_CELL, isNodeSelectable, toNodeID } from '@vers/worldmap-core';
import type { Kysely, Selectable } from 'kysely';
import { getOptimisticBuild } from '../get-optimistic-build';
import { recordNodeUnreachableRejection } from '../metrics/record-node-unreachable-rejection';
import { requireActiveAvatar } from '../require-active-avatar';
import { resolveEncounterNode } from '../resolve-encounter-node';
import { resolveSimVersionStamp } from '../resolve-sim-version-stamp';
import type {
  AdvanceBailPayload,
  AdvanceCheckpointInvalidPayload,
  AvatarNotActivePayload,
  EmptyErrorPayload,
  SimVersionProblemPayload,
} from '../types';

/**
 * Errors `mintRoot` throws directly — a subset of `advanceActivity`'s full error map.
 */
interface MintRootErrors {
  readonly AVATAR_NOT_ACTIVE: (payload: AvatarNotActivePayload) => Error;
  readonly CHAIN_QUARANTINED: (payload: AdvanceBailPayload) => Error;
  readonly CHECKPOINT_INVALID: (payload: AdvanceCheckpointInvalidPayload) => Error;
  readonly CONFLICT: (payload: AdvanceBailPayload) => Error;
  readonly NODE_NOT_REVEALED: (payload: EmptyErrorPayload) => Error;
  readonly NODE_UNKNOWN: (payload: EmptyErrorPayload) => Error;
  readonly NODE_UNREACHABLE: (payload: EmptyErrorPayload) => Error;
  readonly SIM_VERSION_EXPIRED: (payload: SimVersionProblemPayload) => Error;
  readonly SIM_VERSION_UNKNOWN: (payload: SimVersionProblemPayload) => Error;
}

/**
 * Mints a client-submitted root — an activity `advanceActivity`'s caller minted locally and the
 * server has never seen — under the exact gates `startActivity` runs, then validates it against the
 * live chain anchor before inserting it. Ownership of `root.avatarID` is the caller's
 * responsibility: this runs only once the caller has confirmed the acting user owns it. Throws
 * AVATAR_NOT_ACTIVE unless the avatar is the account's active one, NODE_NOT_REVEALED when the scope
 * has no chain row to root against, CHAIN_QUARANTINED when the scope already carries a quarantined
 * row (a quarantine blocks new activity starts on the pair, root mints included), NODE_UNKNOWN when
 * the scope doesn't resolve to a known node, and NODE_UNREACHABLE when it resolves but sits outside
 * the avatar's selectable set. Validates the
 * stamped sim version exactly as a fresh start would (SIM_VERSION_UNKNOWN/SIM_VERSION_EXPIRED), then
 * requires `root.startChainIndex`/`root.seed` to equal the chain's live appended anchor exactly —
 * a mismatch means the client rooted against a stale head, and the row is refused with CONFLICT
 * rather than inserted off an anchor that has since moved. Re-authors `buildSnapshot` from the
 * avatar's own settled-plus-unsettled progression and rejects a mismatch against the client's
 * prediction with CHECKPOINT_INVALID, exactly as a continuation's own mint does; recomputes
 * `startHash` from the root's own pinned fields and rejects a mismatch the same way. The insert
 * itself carries no dedup of its own — the caller resolves a concurrent mint's unique violation
 * once this transaction has rolled back, mirroring how a continuation's own mint-id collision
 * resolves.
 */
export async function mintRoot(
  trx: Kysely<DB>,
  actingUserID: string,
  input: Readonly<{
    activityID: string;
    actingSessionID: null | string;
    root: Readonly<OfflineRootSubmission>;
  }>,
  errors: MintRootErrors,
): Promise<Selectable<Activities>> {
  await requireActiveAvatar(trx, actingUserID, input.root.avatarID, errors);

  const chain = await trx
    .selectFrom('activityChains')
    .select(['appendedNextSeed', 'appendedChainIndex'])
    .where('avatarId', '=', input.root.avatarID)
    .where('scopeType', '=', input.root.scopeType)
    .where('scopeId', '=', input.root.scopeID)
    .forUpdate()
    .executeTakeFirst();

  if (chain === undefined) {
    throw errors.NODE_NOT_REVEALED({ data: {} });
  }

  const quarantined = await trx
    .selectFrom('activities')
    .select('id')
    .where('avatarId', '=', input.root.avatarID)
    .where('scopeType', '=', input.root.scopeType)
    .where('scopeId', '=', input.root.scopeID)
    .where('status', '=', 'quarantined')
    .executeTakeFirst();

  if (quarantined !== undefined) {
    throw errors.CHAIN_QUARANTINED({
      data: { activityID: input.activityID, appendedHead: 0 },
    });
  }

  const resolved = resolveEncounterNode(input.root.scopeType, input.root.scopeID);

  if (resolved === undefined) {
    throw errors.NODE_UNKNOWN({ data: {} });
  }

  // the origin is unconditionally selectable, so a root there needs no grants read to decide
  if (
    input.root.scopeType === 'world_map_node' &&
    input.root.scopeID !== toNodeID(ORIGIN_CELL[0], ORIGIN_CELL[1])
  ) {
    const avatar = await trx
      .selectFrom('avatars')
      .select('seed')
      .where('id', '=', input.root.avatarID)
      .executeTakeFirstOrThrow();

    const grants = await trx
      .selectFrom('avatarGrants')
      .select('key')
      .where('avatarId', '=', input.root.avatarID)
      .where('kind', '=', 'first_clear')
      .execute();

    const completedNodeIDs = new Set(grants.map((grant) => grant.key));

    if (!isNodeSelectable(avatar.seed, completedNodeIDs, input.root.scopeID)) {
      recordNodeUnreachableRejection();
      throw errors.NODE_UNREACHABLE({ data: {} });
    }
  }

  const simVersion = await resolveSimVersionStamp(
    trx,
    input.root.simVersion,
    input.root.contentVersion,
    errors,
  );

  if (
    input.root.startChainIndex !== chain.appendedChainIndex ||
    input.root.seed !== chain.appendedNextSeed
  ) {
    throw errors.CONFLICT({ data: { activityID: input.activityID, appendedHead: 0 } });
  }

  const optimistic = await getOptimisticBuild(trx, input.root.avatarID);

  const buildSnapshot: BuildSnapshot = {
    level: buildLevelFromXP(optimistic.totalXP),
    xp: optimistic.totalXP,
  };

  if (
    buildSnapshot.level !== input.root.buildSnapshot.level ||
    buildSnapshot.xp !== input.root.buildSnapshot.xp
  ) {
    throw errors.CHECKPOINT_INVALID({
      data: { activityID: input.activityID, appendedHead: 0, reason: 'build-snapshot-mismatch' },
    });
  }

  const startHash = buildStartHash({
    contentVersion: input.root.contentVersion,
    encounterNode: input.root.encounterNode,
    keyVersion: input.root.keyVersion,
    seed: input.root.seed,
    simVersion,
  });

  if (startHash !== input.root.startHash) {
    throw errors.CHECKPOINT_INVALID({
      data: { activityID: input.activityID, appendedHead: 0, reason: 'start-hash-mismatch' },
    });
  }

  const row = await trx
    .insertInto('activities')
    .values({
      avatarId: input.root.avatarID,
      buildSnapshot,
      contentVersion: input.root.contentVersion,
      encounterNode: input.root.encounterNode,
      id: input.activityID,
      keyVersion: input.root.keyVersion,
      lastHash: startHash,
      scopeId: input.root.scopeID,
      scopeType: input.root.scopeType,
      secretRef: input.root.secretRef,
      secretVersion: input.root.secretVersion,
      seed: input.root.seed,
      simVersion,
      startChainIndex: input.root.startChainIndex,
      startHash,
      startKey: input.root.startKey,
      writerSessionId: input.actingSessionID,
    })
    .returningAll()
    .executeTakeFirstOrThrow();

  if (optimistic.sourceIDs.length > 0) {
    await trx
      .insertInto('activitySnapshotSources')
      .values(
        optimistic.sourceIDs.map((sourceID) => ({
          activityId: input.activityID,
          sourceActivityId: sourceID,
        })),
      )
      .execute();
  }

  return row;
}
