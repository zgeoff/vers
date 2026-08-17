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
import type { CryptoKey } from 'jose';
import type { Kysely, Selectable } from 'kysely';
import { getOptimisticBuild } from '../get-optimistic-build';
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
 * The content loader and key and secret material a root mint derives its authoritative encounter
 * and stamps from.
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
 * The typed error constructors a root mint throws.
 */
interface MintRootErrors {
  readonly AVATAR_NOT_ACTIVE: (payload: AvatarNotActivePayload) => Error;
  readonly CHAIN_QUARANTINED: (payload: AdvanceBailPayload) => Error;
  readonly CHECKPOINT_INVALID: (payload: AdvanceCheckpointInvalidPayload) => Error;
  readonly CONFLICT: (payload: AdvanceBailPayload) => Error;
  readonly NODE_NOT_REVEALED: (payload: EmptyErrorPayload) => Error;
  readonly NODE_UNKNOWN: (payload: EmptyErrorPayload) => Error;
  readonly SIM_VERSION_EXPIRED: (payload: SimVersionProblemPayload) => Error;
  readonly SIM_VERSION_UNKNOWN: (payload: SimVersionProblemPayload) => Error;
}

/**
 * Mints a client-submitted activity root — one the caller minted offline and the server has never
 * seen — validating it against server truth rather than trusting its payload. Every authoritative
 * input, the encounter node and the key and secret stamps, is derived server-side, and the client's
 * seed, versions, build snapshot, and start hash must reconcile with what the server derives. The
 * caller must confirm the acting user owns `root.avatarID` before calling.
 *
 * Throws AVATAR_NOT_ACTIVE, CHAIN_QUARANTINED, NODE_UNKNOWN, NODE_NOT_REVEALED,
 * SIM_VERSION_UNKNOWN, or SIM_VERSION_EXPIRED for a root that fails a start gate; CONFLICT when it
 * roots against a stale chain head; CHECKPOINT_INVALID when its build snapshot or start hash
 * disagree with the server's own derivation.
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

  // resolve the scope before the chain lookup below: a scope no node maps to classifies NODE_UNKNOWN,
  // distinct from the NODE_NOT_REVEALED a valid-but-unrevealed scope earns when its chain row is absent
  const resolved = resolveEncounterNode(root.scopeType, root.scopeID);

  if (resolved === undefined) {
    throw errors.NODE_UNKNOWN({ data: {} });
  }

  const avatar = await trx
    .selectFrom('avatars')
    .select('seed')
    .where('id', '=', root.avatarID)
    .executeTakeFirstOrThrow();

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

  // the root must sit on the chain's live appended head exactly; any other index or seed means the
  // client built on a stale head that a concurrent append has already moved past
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

  // derive the encounter and stamps from the server's own content and scope secret, never the client
  // payload, so a poisoned encounter or forged stamp can never enter the row
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

  // equality proves the client folded its hash over the same content and encounter the server just
  // derived; a mismatch means it simulated against something else and cannot be rooted
  if (startHash !== root.startHash) {
    throw errors.CHECKPOINT_INVALID({
      data: { activityID: input.activityID, appendedHead: 0, reason: 'start-hash-mismatch' },
    });
  }

  // no dedup here; a concurrent mint's unique violation is resolved by the caller once this
  // transaction has rolled back
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
      playedAt: root.playedAt,
      predecessorActivityId: root.predecessorActivityID,
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

  return row;
}
