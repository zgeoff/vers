import type {
  BuildSnapshot,
  ContentDocument,
  OfflineRootSubmission,
} from '@vers/contract-activity';
import { buildStartHash } from '@vers/contract-activity';
import type { SecretRef } from '@vers/contract-keys';
import type { Activities, DB } from '@vers/db';
import { buildLevelFromXP } from '@vers/idle-core';
import { findCurrentSimVersion } from '@vers/sim-registry';
import { deriveWorldmapContent, readScopeSecret } from '@vers/worldmap-content';
import { ORIGIN_CELL, isNodeSelectable, toNodeID } from '@vers/worldmap-core';
import type { CryptoKey } from 'jose';
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
 * The content-document loader and the keys/signing inputs a root mint derives its authoritative
 * encounter and stamps from — the same dependencies a fresh `startActivity` closes over.
 */
interface MintRootDeps {
  readonly keysServiceURL: string;
  readonly keyVersion: number;
  readonly loadContentDocument: (contentVersion: string) => Promise<ContentDocument | undefined>;
  readonly privateKey: CryptoKey;
  readonly secretRef: SecretRef;
  readonly secretVersion: number;
}

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
 * server has never seen — under the exact gates `startActivity` runs, deriving every authoritative
 * input from server truth rather than trusting the client's payload. Ownership of `root.avatarID`
 * is the caller's responsibility: this runs only once the caller has confirmed the acting user owns
 * it.
 *
 * The scope resolves before the chain-presence check, matching `startActivity`'s classification
 * order: an unknown avatar throws AVATAR_NOT_ACTIVE, a quarantined chain throws CHAIN_QUARANTINED, a
 * scope that resolves to no known node throws NODE_UNKNOWN, one that resolves but sits outside the
 * avatar's selectable set throws NODE_UNREACHABLE, and a scope with no chain row to root against
 * throws NODE_NOT_REVEALED. The stamped sim version is validated exactly as a fresh start would
 * (SIM_VERSION_UNKNOWN/SIM_VERSION_EXPIRED), and a content version the registry no longer publishes
 * throws SIM_VERSION_EXPIRED rather than failing the derivation below.
 *
 * `root.startChainIndex`/`root.seed` must equal the chain's live appended anchor exactly — a
 * mismatch means the client rooted against a stale head, refused with CONFLICT. `buildSnapshot` is
 * re-authored from the avatar's own settled-plus-unsettled progression and a mismatch against the
 * client's prediction bails CHECKPOINT_INVALID, exactly as a continuation's own mint does.
 *
 * The encounter node and the key/secret stamps are derived server-side: the encounter from the
 * content document, scope secret, and avatar seed via `deriveWorldmapContent`, and
 * `keyVersion`/`secretRef`/`secretVersion` from the mint's own deps. `startHash` is recomputed from
 * those server-derived inputs and the client's `seed`/`contentVersion`/`simVersion`, and the
 * client's submitted `startHash` must equal it or the mint bails CHECKPOINT_INVALID — proof the
 * client simulated against the same content and encounter the server derives from its own truth.
 * The row stores the server-derived encounter and stamps.
 *
 * The insert itself carries no dedup of its own — the caller resolves a concurrent mint's unique
 * violation once this transaction has rolled back, mirroring how a continuation's own mint-id
 * collision resolves.
 */
export async function mintRoot(
  deps: Readonly<MintRootDeps>,
  trx: Kysely<DB>,
  actingUserID: string,
  input: Readonly<{
    activityID: string;
    actingSessionID: null | string;
    root: Readonly<OfflineRootSubmission>;
  }>,
  errors: MintRootErrors,
): Promise<Selectable<Activities>> {
  const root = input.root;

  await requireActiveAvatar(trx, actingUserID, root.avatarID, errors);

  const quarantined = await trx
    .selectFrom('activities')
    .select('id')
    .where('avatarId', '=', root.avatarID)
    .where('scopeType', '=', root.scopeType)
    .where('scopeId', '=', root.scopeID)
    .where('status', '=', 'quarantined')
    .executeTakeFirst();

  if (quarantined !== undefined) {
    throw errors.CHAIN_QUARANTINED({
      data: { activityID: input.activityID, appendedHead: 0 },
    });
  }

  const resolved = resolveEncounterNode(root.scopeType, root.scopeID);

  if (resolved === undefined) {
    throw errors.NODE_UNKNOWN({ data: {} });
  }

  const avatar = await trx
    .selectFrom('avatars')
    .select('seed')
    .where('id', '=', root.avatarID)
    .executeTakeFirstOrThrow();

  // the origin is unconditionally selectable, so a root there needs no grants read to decide
  if (
    root.scopeType === 'world_map_node' &&
    root.scopeID !== toNodeID(ORIGIN_CELL[0], ORIGIN_CELL[1])
  ) {
    const grants = await trx
      .selectFrom('avatarGrants')
      .select('key')
      .where('avatarId', '=', root.avatarID)
      .where('kind', '=', 'first_clear')
      .execute();

    const completedNodeIDs = new Set(grants.map((grant) => grant.key));

    if (!isNodeSelectable(avatar.seed, completedNodeIDs, root.scopeID)) {
      recordNodeUnreachableRejection();
      throw errors.NODE_UNREACHABLE({ data: {} });
    }
  }

  const chain = await trx
    .selectFrom('activityChains')
    .select(['appendedNextSeed', 'appendedChainIndex'])
    .where('avatarId', '=', root.avatarID)
    .where('scopeType', '=', root.scopeType)
    .where('scopeId', '=', root.scopeID)
    .forUpdate()
    .executeTakeFirst();

  if (chain === undefined) {
    throw errors.NODE_NOT_REVEALED({ data: {} });
  }

  const simVersion = await resolveSimVersionStamp(
    trx,
    root.simVersion,
    root.contentVersion,
    errors,
  );

  if (root.startChainIndex !== chain.appendedChainIndex || root.seed !== chain.appendedNextSeed) {
    throw errors.CONFLICT({ data: { activityID: input.activityID, appendedHead: 0 } });
  }

  const optimistic = await getOptimisticBuild(trx, root.avatarID);

  const buildSnapshot: BuildSnapshot = {
    level: buildLevelFromXP(optimistic.totalXP),
    xp: optimistic.totalXP,
  };

  if (
    buildSnapshot.level !== root.buildSnapshot.level ||
    buildSnapshot.xp !== root.buildSnapshot.xp
  ) {
    throw errors.CHECKPOINT_INVALID({
      data: { activityID: input.activityID, appendedHead: 0, reason: 'build-snapshot-mismatch' },
    });
  }

  const document = await deps.loadContentDocument(root.contentVersion);

  if (document === undefined) {
    const current = await findCurrentSimVersion(trx);

    throw errors.SIM_VERSION_EXPIRED({ data: { currentSimVersion: current?.engineHash ?? null } });
  }

  const scopeSecret = await readScopeSecret(
    {
      issuer: 'service-activity',
      keysServiceURL: deps.keysServiceURL,
      privateKey: deps.privateKey,
    },
    { avatarID: root.avatarID, secretRef: deps.secretRef, secretVersion: deps.secretVersion },
  );

  const encounterNode = {
    difficulty: resolved.difficulty,
    ...deriveWorldmapContent(document.encounter, {
      coord: resolved.coord,
      scopeSecret,
      userSeed: avatar.seed,
    }),
  };

  const startHash = buildStartHash({
    contentVersion: root.contentVersion,
    encounterNode,
    keyVersion: deps.keyVersion,
    seed: root.seed,
    simVersion,
  });

  if (startHash !== root.startHash) {
    throw errors.CHECKPOINT_INVALID({
      data: { activityID: input.activityID, appendedHead: 0, reason: 'start-hash-mismatch' },
    });
  }

  const row = await trx
    .insertInto('activities')
    .values({
      avatarId: root.avatarID,
      buildSnapshot,
      contentVersion: root.contentVersion,
      encounterNode,
      id: input.activityID,
      keyVersion: deps.keyVersion,
      lastHash: startHash,
      scopeId: root.scopeID,
      scopeType: root.scopeType,
      secretRef: deps.secretRef,
      secretVersion: deps.secretVersion,
      seed: root.seed,
      simVersion,
      startChainIndex: root.startChainIndex,
      startHash,
      startKey: root.startKey,
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
