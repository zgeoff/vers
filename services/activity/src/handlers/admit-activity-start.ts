import type {
  BuildSnapshot,
  ContentDocument,
  OfflineActivityStartSubmission,
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

interface AdmitActivityStartDeps {
  readonly keysServiceURL: string;
  readonly keyVersion: number;
  readonly loadContentDocument: (contentVersion: string) => Promise<ContentDocument | undefined>;
  readonly privateKey: CryptoKey;
  readonly secretRef: SecretRef;
  readonly secretVersion: number;
}

interface AdmitActivityStartErrors {
  readonly AVATAR_NOT_ACTIVE: (payload: AvatarNotActivePayload) => Error;
  readonly CHAIN_QUARANTINED: (payload: AdvanceBailPayload) => Error;
  readonly CHECKPOINT_INVALID: (payload: AdvanceCheckpointInvalidPayload) => Error;
  readonly CONFLICT: (payload: AdvanceBailPayload) => Error;
  readonly NODE_NOT_REVEALED: (payload: EmptyErrorPayload) => Error;
  readonly NODE_UNKNOWN: (payload: EmptyErrorPayload) => Error;
  readonly SIM_VERSION_EXPIRED: (payload: SimVersionProblemPayload) => Error;
  readonly SIM_VERSION_UNKNOWN: (payload: SimVersionProblemPayload) => Error;
}

export async function admitActivityStart(
  deps: Readonly<AdmitActivityStartDeps>,
  trx: Kysely<DB>,
  actingUserID: string,
  input: Readonly<{
    activityID: string;
    actingSessionID: null | string;
    activityStart: Readonly<OfflineActivityStartSubmission>;
  }>,
  errors: AdmitActivityStartErrors,
): Promise<Selectable<Activities>> {
  const activityStart = input.activityStart;

  await requireActiveAvatar(trx, actingUserID, activityStart.avatarID, errors);

  const quarantined = await trx
    .selectFrom('activities')
    .select('id')
    .where('avatarId', '=', activityStart.avatarID)
    .where('scopeType', '=', activityStart.scopeType)
    .where('scopeId', '=', activityStart.scopeID)
    .where('status', '=', 'quarantined')
    .executeTakeFirst();

  if (quarantined !== undefined) {
    throw errors.CHAIN_QUARANTINED({
      data: { activityID: input.activityID, appendedHead: 0 },
    });
  }

  // resolve the scope before the chain lookup below: a scope no node maps to classifies
  // NODE_UNKNOWN, distinct from the NODE_NOT_REVEALED a valid-but-unrevealed scope earns when its
  // chain row is absent
  const resolved = resolveEncounterNode(activityStart.scopeType, activityStart.scopeID);

  if (resolved === undefined) {
    throw errors.NODE_UNKNOWN({ data: {} });
  }

  const avatar = await trx
    .selectFrom('avatars')
    .select('seed')
    .where('id', '=', activityStart.avatarID)
    .executeTakeFirstOrThrow();

  const chain = await trx
    .selectFrom('activityChains')
    .select(['appendedNextSeed', 'appendedChainIndex'])
    .where('avatarId', '=', activityStart.avatarID)
    .where('scopeType', '=', activityStart.scopeType)
    .where('scopeId', '=', activityStart.scopeID)
    .forUpdate()
    .executeTakeFirst();

  if (chain === undefined) {
    throw errors.NODE_NOT_REVEALED({ data: {} });
  }

  const simVersion = await resolveSimVersionStamp(
    trx,
    activityStart.simVersion,
    activityStart.contentVersion,
    errors,
  );

  // the activity start must sit on the chain's live appended head exactly; any other index or seed
  // means the client built on a stale head that a concurrent append has already moved past
  if (
    activityStart.startChainIndex !== chain.appendedChainIndex ||
    activityStart.seed !== chain.appendedNextSeed
  ) {
    throw errors.CONFLICT({ data: { activityID: input.activityID, appendedHead: 0 } });
  }

  const optimistic = await getOptimisticBuild(trx, activityStart.avatarID);

  const buildSnapshot: BuildSnapshot = {
    level: buildLevelFromXP(optimistic.totalXP),
    xp: optimistic.totalXP,
  };

  if (
    buildSnapshot.level !== activityStart.buildSnapshot.level ||
    buildSnapshot.xp !== activityStart.buildSnapshot.xp
  ) {
    throw errors.CHECKPOINT_INVALID({
      data: { activityID: input.activityID, appendedHead: 0, reason: 'build-snapshot-mismatch' },
    });
  }

  const document = await deps.loadContentDocument(activityStart.contentVersion);

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
    {
      avatarID: activityStart.avatarID,
      secretRef: deps.secretRef,
      secretVersion: deps.secretVersion,
    },
  );

  // derive the encounter and stamps from the server's own content and scope secret, never the
  // client payload, so a poisoned encounter or forged stamp can never enter the row
  const encounterNode = {
    difficulty: resolved.difficulty,
    ...deriveWorldmapContent(document.encounter, {
      coord: resolved.coord,
      scopeSecret,
      userSeed: avatar.seed,
    }),
  };

  const startHash = buildStartHash({
    contentVersion: activityStart.contentVersion,
    encounterNode,
    keyVersion: deps.keyVersion,
    seed: activityStart.seed,
    simVersion,
  });

  // equality proves the client folded its hash over the same content and encounter the server just
  // derived; a mismatch means it simulated against something else and cannot be anchored
  if (startHash !== activityStart.startHash) {
    throw errors.CHECKPOINT_INVALID({
      data: { activityID: input.activityID, appendedHead: 0, reason: 'start-hash-mismatch' },
    });
  }

  // no dedup here; a concurrent admission's unique violation is resolved by the caller once this
  // transaction has rolled back
  const row = await trx
    .insertInto('activities')
    .values({
      avatarId: activityStart.avatarID,
      buildSnapshot,
      contentVersion: activityStart.contentVersion,
      encounterNode,
      id: input.activityID,
      keyVersion: deps.keyVersion,
      lastHash: startHash,
      playedAt: activityStart.playedAt,
      predecessorActivityId: activityStart.predecessorActivityID,
      scopeId: activityStart.scopeID,
      scopeType: activityStart.scopeType,
      secretRef: deps.secretRef,
      secretVersion: deps.secretVersion,
      seed: activityStart.seed,
      simVersion,
      startChainIndex: activityStart.startChainIndex,
      startHash,
      startKey: activityStart.startKey,
      writerSessionId: input.actingSessionID,
    })
    .returningAll()
    .executeTakeFirstOrThrow();

  return row;
}
