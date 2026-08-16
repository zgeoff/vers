import { createId } from '@paralleldrive/cuid2';
import { findCurrentContentVersion } from '@vers/content-registry';
import type { ActivityData, BuildSnapshot, ContentDocument } from '@vers/contract-activity';
import { buildStartHash } from '@vers/contract-activity';
import type { SecretRef } from '@vers/contract-keys';
import type { DB } from '@vers/db';
import { buildLevelFromXP } from '@vers/idle-core';
import { deriveWorldmapContent, readScopeSecret } from '@vers/worldmap-content';
import { ORIGIN_CELL, isNodeSelectable, toNodeID } from '@vers/worldmap-core';
import type { CryptoKey } from 'jose';
import type { Kysely } from 'kysely';
import invariant from 'tiny-invariant';
import { getOptimisticBuild } from '../get-optimistic-build';
import { isUniqueViolation } from '../is-unique-violation';
import { recordNodeUnreachableRejection } from '../metrics/record-node-unreachable-rejection';
import { requireActiveAvatar } from '../require-active-avatar';
import { resolveEncounterNode } from '../resolve-encounter-node';
import { resolveSimVersionStamp } from '../resolve-sim-version-stamp';
import type {
  ActiveActivityConflictPayload,
  AvatarNotActivePayload,
  EmptyErrorPayload,
  MissingSessionPayload,
  SimVersionProblemPayload,
} from '../types';
import { toActivityData } from './to-activity-data';

/**
 * Db handle plus the memoized content-document loader and key version every new activity is
 * minted against, and the keys dispatch a start reads its scope secret over — both the sim
 * version and the current content version are resolved per request from their registries, never
 * a fixed dep.
 */
interface StartActivityDeps {
  readonly db: Kysely<DB>;
  readonly keysServiceURL: string;
  readonly keyVersion: number;
  readonly loadContentDocument: (contentVersion: string) => Promise<ContentDocument | undefined>;
  readonly privateKey: CryptoKey;
  readonly secretRef: SecretRef;
  readonly secretVersion: number;
}

/**
 * oRPC handler opts for the authed `startActivity` procedure.
 */
interface StartActivityOpts {
  readonly context: {
    readonly actingSessionId: null | string;
    readonly actingUserId: null | string;
  };
  readonly errors: {
    readonly AVATAR_NOT_ACTIVE: (payload: AvatarNotActivePayload) => Error;
    readonly CHAIN_QUARANTINED: (payload: EmptyErrorPayload) => Error;
    readonly CONFLICT: (payload: ActiveActivityConflictPayload) => Error;
    readonly NODE_NOT_REVEALED: (payload: EmptyErrorPayload) => Error;
    readonly NODE_UNKNOWN: (payload: EmptyErrorPayload) => Error;
    readonly NODE_UNREACHABLE: (payload: EmptyErrorPayload) => Error;
    readonly NOT_FOUND: (payload: EmptyErrorPayload) => Error;
    readonly SIM_VERSION_EXPIRED: (payload: SimVersionProblemPayload) => Error;
    readonly SIM_VERSION_UNKNOWN: (payload: SimVersionProblemPayload) => Error;
    readonly UNAUTHORIZED: (payload: MissingSessionPayload) => Error;
  };
  readonly input: {
    readonly avatarID: string;
    readonly playedAt?: Date | null | undefined;
    readonly predecessorActivityID?: null | string | undefined;
    readonly scopeID: string;
    readonly scopeType: string;
    readonly simVersion?: string | undefined;
    readonly startKey?: string | undefined;
  };
}

/**
 * Starts an activity for an avatar owned by the acting user, snapshotting the build the stream
 * plays against, and stamping the acting session as the stream's writer. The snapshot carries the
 * avatar's settled xp/level plus the unsettled xp of every run of its own that ended and still
 * awaits its verifier, so a chain of activities started faster than the verifier settles them each
 * builds against the last one's outcome rather than replaying stale progression. A held run —
 * parked or quarantined — contributes nothing, since it has no path back to verification on its
 * own and its xp would otherwise ride in this snapshot and every later one permanently. Resolves the scope
 * node's encounter params server-side and freezes them on the new row, throwing NODE_UNKNOWN when
 * the scope doesn't resolve to a known node and NODE_UNREACHABLE when it resolves but sits outside
 * the avatar's selectable set — the origin, a completed node, or a neighbour of one, evaluated
 * against the avatar's own `first_clear` grants. The chain it roots against must already exist —
 * `revealNodes` mints it at reveal time — so a scope with no chain row throws NODE_NOT_REVEALED
 * rather than minting one here. The partial unique index serializes concurrent starts;
 * a duplicate delivery — same key, same scope, never appended, caller already the writer or none
 * stamped — succeeds with the existing row, and every other conflict throws CONFLICT carrying it. A
 * chain whose replay frontier is quarantined admits no new starts until it is adjudicated.
 * Admission is additionally gated to the account's active avatar under the same per-user advisory
 * lock the avatar service's selection and creation endpoints take, so the pair serializes; a start
 * for any other avatar throws AVATAR_NOT_ACTIVE naming the account's actual active avatar. Persists
 * the caller's `predecessorActivityID`/`playedAt` as-is — the client alone witnessed the play order,
 * and the server trusts the reference for settlement sequencing only, never for legality.
 */
export async function startActivity(
  deps: StartActivityDeps,
  opts: StartActivityOpts,
): Promise<ActivityData> {
  const actingUserID = opts.context.actingUserId;

  if (actingUserID === null) {
    throw opts.errors.UNAUTHORIZED({ data: { reason: 'missing-session' } });
  }

  const avatar = await deps.db
    .selectFrom('avatars')
    .selectAll()
    .where('id', '=', opts.input.avatarID)
    .where('userId', '=', actingUserID)
    .executeTakeFirst();

  if (avatar === undefined) {
    throw opts.errors.NOT_FOUND({ data: {} });
  }

  const quarantined = await deps.db
    .selectFrom('activities')
    .select('id')
    .where('avatarId', '=', opts.input.avatarID)
    .where('scopeType', '=', opts.input.scopeType)
    .where('scopeId', '=', opts.input.scopeID)
    .where('status', '=', 'quarantined')
    .executeTakeFirst();

  if (quarantined !== undefined) {
    throw opts.errors.CHAIN_QUARANTINED({ data: {} });
  }

  const resolved = resolveEncounterNode(opts.input.scopeType, opts.input.scopeID);

  if (resolved === undefined) {
    throw opts.errors.NODE_UNKNOWN({ data: {} });
  }

  // the origin is unconditionally selectable, so a start there needs no grants read to decide
  if (
    opts.input.scopeType === 'world_map_node' &&
    opts.input.scopeID !== toNodeID(ORIGIN_CELL[0], ORIGIN_CELL[1])
  ) {
    const grants = await deps.db
      .selectFrom('avatarGrants')
      .select('key')
      .where('avatarId', '=', avatar.id)
      .where('kind', '=', 'first_clear')
      .execute();

    const completedNodeIDs = new Set(grants.map((grant) => grant.key));

    if (!isNodeSelectable(avatar.seed, completedNodeIDs, opts.input.scopeID)) {
      recordNodeUnreachableRejection();
      throw opts.errors.NODE_UNREACHABLE({ data: {} });
    }
  }

  const contentVersion = await findCurrentContentVersion(deps.db);

  invariant(contentVersion !== undefined, 'content registry has no current version');

  const document = await deps.loadContentDocument(contentVersion);

  invariant(document, `current content version ${contentVersion} is not published`);

  // Read before the transaction opens, keeping the advisory-lock window it holds small; a keys
  // dispatch failure (the service unreachable, or a config bug the keys client's own guard already
  // demoted to a plain Error) escapes uncaught to the central error interceptor, a 500 — never a
  // typed error this handler defines.
  const scopeSecret = await readScopeSecret(
    {
      issuer: 'service-activity',
      keysServiceURL: deps.keysServiceURL,
      privateKey: deps.privateKey,
    },
    { avatarID: opts.input.avatarID, secretRef: deps.secretRef, secretVersion: deps.secretVersion },
  );

  const encounterNode = {
    difficulty: resolved.difficulty,
    ...deriveWorldmapContent(document.encounter, {
      coord: resolved.coord,
      scopeSecret,
      userSeed: avatar.seed,
    }),
  };

  const simVersion = await resolveSimVersionStamp(
    deps.db,
    opts.input.simVersion,
    contentVersion,
    opts.errors,
  );

  const id = `act_${createId()}`;

  try {
    // One transaction, per-user advisory lock first, chain row second: the advisory lock
    // serializes this against the avatar service's own selection and creation calls so
    // start-vs-switch is atomic, and the chain row's SELECT FOR UPDATE lock is held until commit,
    // so a forward exit advancing this chain's anchor either commits before the anchor is read
    // here or waits behind it — a new activity always roots at the anchor current at read time.
    // Every writer that touches both rows acquires the chain row before the activity row, and the
    // advisory lock is taken before either, so no interleaving admits a lock cycle.
    const row = await deps.db.transaction().execute(async (trx) => {
      await requireActiveAvatar(trx, actingUserID, opts.input.avatarID, opts.errors);

      const chain = await trx
        .selectFrom('activityChains')
        .select(['appendedNextSeed', 'appendedChainIndex'])
        .where('avatarId', '=', opts.input.avatarID)
        .where('scopeType', '=', opts.input.scopeType)
        .where('scopeId', '=', opts.input.scopeID)
        .forUpdate()
        .executeTakeFirst();

      if (chain === undefined) {
        throw opts.errors.NODE_NOT_REVEALED({ data: {} });
      }

      const seed = chain.appendedNextSeed;

      const optimistic = await getOptimisticBuild(trx, opts.input.avatarID);

      const buildSnapshot: BuildSnapshot = {
        level: buildLevelFromXP(optimistic.totalXP),
        xp: optimistic.totalXP,
      };

      const startHash = buildStartHash({
        contentVersion,
        encounterNode,
        keyVersion: deps.keyVersion,
        seed,
        simVersion,
      });

      const inserted = await trx
        .insertInto('activities')
        .values({
          avatarId: opts.input.avatarID,
          buildSnapshot,
          contentVersion,
          encounterNode,
          id,
          keyVersion: deps.keyVersion,
          lastHash: startHash,
          playedAt: opts.input.playedAt ?? null,
          predecessorActivityId: opts.input.predecessorActivityID ?? null,
          scopeId: opts.input.scopeID,
          scopeType: opts.input.scopeType,
          secretRef: deps.secretRef,
          secretVersion: deps.secretVersion,
          seed,
          simVersion,
          startChainIndex: chain.appendedChainIndex,
          startHash,
          startKey: opts.input.startKey ?? null,
          writerSessionId: opts.context.actingSessionId,
        })
        .returningAll()
        .executeTakeFirstOrThrow();

      return inserted;
    });

    return toActivityData(row);
  } catch (error: unknown) {
    if (!isUniqueViolation(error)) {
      throw error;
    }

    const existing = await deps.db
      .selectFrom('activities')
      .selectAll()
      .where('avatarId', '=', opts.input.avatarID)
      .where('status', '=', 'active')
      .executeTakeFirstOrThrow();

    // Key equality is the intent test: a duplicate delivery gets back the row it already minted,
    // while a continuation into the same scope carries a different key and must conflict — or it
    // would adopt the very row it just closed.
    const isDuplicateStart =
      opts.input.startKey !== undefined &&
      existing.startKey === opts.input.startKey &&
      existing.scopeType === opts.input.scopeType &&
      existing.scopeId === opts.input.scopeID &&
      existing.appendedHead === 0 &&
      (existing.writerSessionId === null ||
        existing.writerSessionId === opts.context.actingSessionId);

    if (isDuplicateStart) {
      return toActivityData(existing);
    }

    throw opts.errors.CONFLICT({ data: { activity: toActivityData(existing) } });
  }
}
