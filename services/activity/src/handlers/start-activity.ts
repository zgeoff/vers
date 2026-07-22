import { createId } from '@paralleldrive/cuid2';
import type { ActivityData, BuildSnapshot } from '@vers/contract-activity';
import { buildStartHash, createGenesisSeed } from '@vers/contract-activity';
import type { DB } from '@vers/db';
import { buildLevelFromXP } from '@vers/idle-core';
import { findCurrentSimVersion, findSimVersion } from '@vers/sim-registry';
import type { Kysely } from 'kysely';
import invariant from 'tiny-invariant';
import { parseTerminalCheckpointXP } from '../parse-terminal-checkpoint-xp';
import { resolveEncounterNode } from '../resolve-encounter-node';
import type {
  ActiveActivityConflictPayload,
  EmptyErrorPayload,
  MissingSessionPayload,
  SimVersionProblemPayload,
} from '../types';
import { toActivityData } from './to-activity-data';

/**
 * Db handle plus the content and key versions every new activity is minted against — the sim
 * version is resolved per request from the registry, never a fixed dep.
 */
interface StartActivityDeps {
  readonly contentVersion: string;
  readonly db: Kysely<DB>;
  readonly keyVersion: number;
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
    readonly CHAIN_QUARANTINED: (payload: EmptyErrorPayload) => Error;
    readonly CONFLICT: (payload: ActiveActivityConflictPayload) => Error;
    readonly NODE_UNKNOWN: (payload: EmptyErrorPayload) => Error;
    readonly NOT_FOUND: (payload: EmptyErrorPayload) => Error;
    readonly SIM_VERSION_EXPIRED: (payload: SimVersionProblemPayload) => Error;
    readonly SIM_VERSION_UNKNOWN: (payload: SimVersionProblemPayload) => Error;
    readonly UNAUTHORIZED: (payload: MissingSessionPayload) => Error;
  };
  readonly input: {
    readonly avatarID: string;
    readonly scopeID: string;
    readonly scopeType: string;
    readonly simVersion?: string | undefined;
    readonly startKey?: string | undefined;
  };
}

/**
 * Starts an activity for an avatar owned by the acting user, snapshotting the build the stream
 * plays against, and stamping the acting session as the stream's writer. The snapshot carries the
 * avatar's settled xp/level plus the xp of every terminal-but-unsettled activity of its own — a
 * stopped, capped, quarantined, or parked activity whose verified anchor hasn't caught up to its
 * appended tail — so a chain of activities started faster than the verifier settles them each
 * builds against the last one's outcome rather than replaying stale progression. Resolves the scope
 * node's encounter params server-side and freezes them on the new row, throwing NODE_UNKNOWN when
 * the scope doesn't resolve to a known node. The partial unique index serializes concurrent starts;
 * a duplicate delivery — same key, same scope, never appended, caller already the writer or none
 * stamped — succeeds with the existing row, and every other conflict throws CONFLICT carrying it. A
 * chain whose replay frontier is quarantined admits no new starts until it is adjudicated.
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

  const encounterNode = resolveEncounterNode(opts.input.scopeType, opts.input.scopeID);

  if (encounterNode === undefined) {
    throw opts.errors.NODE_UNKNOWN({ data: {} });
  }

  const simVersion = await resolveSimVersionStamp(deps.db, opts.input.simVersion, opts.errors);

  const id = `act_${createId()}`;
  const genesisSeed = createGenesisSeed();

  try {
    // One transaction, chain row first: the upsert's write lock is held until commit, so a
    // forward exit advancing this chain's anchor either commits before the anchor is read here or
    // waits behind it — a new activity always roots at the anchor current at insert time. Every
    // writer that touches both rows acquires the chain row before the activity row, so no
    // interleaving admits a lock cycle.
    const row = await deps.db.transaction().execute(async (trx) => {
      const chain = await trx
        .insertInto('activityChains')
        .values({
          appendedNextSeed: genesisSeed,
          avatarId: opts.input.avatarID,
          genesisSeed,
          scopeId: opts.input.scopeID,
          scopeType: opts.input.scopeType,
          verifiedNextSeed: genesisSeed,
        })
        .onConflict((oc) =>
          oc
            .columns(['avatarId', 'scopeType', 'scopeId'])
            .doUpdateSet({ genesisSeed: (eb) => eb.ref('activityChains.genesisSeed') }),
        )
        .returning(['appendedNextSeed', 'appendedChainIndex'])
        .executeTakeFirstOrThrow();

      const seed = chain.appendedNextSeed;

      const totalXP = await getOptimisticXP(trx, opts.input.avatarID);

      const buildSnapshot: BuildSnapshot = { level: buildLevelFromXP(totalXP), xp: totalXP };

      const startHash = buildStartHash({
        activityID: id,
        contentVersion: deps.contentVersion,
        encounterNode,
        keyVersion: deps.keyVersion,
        seed,
        simVersion,
      });

      return trx
        .insertInto('activities')
        .values({
          avatarId: opts.input.avatarID,
          buildSnapshot,
          contentVersion: deps.contentVersion,
          encounterNode,
          id,
          keyVersion: deps.keyVersion,
          lastHash: startHash,
          scopeId: opts.input.scopeID,
          scopeType: opts.input.scopeType,
          seed,
          simVersion,
          startChainIndex: chain.appendedChainIndex,
          startHash,
          startKey: opts.input.startKey ?? null,
          writerSessionId: opts.context.actingSessionId,
        })
        .returningAll()
        .executeTakeFirstOrThrow();
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

/**
 * Errors `resolveSimVersionStamp` can throw — a subset of the handler's full error map.
 */
interface SimVersionStampErrors {
  readonly SIM_VERSION_EXPIRED: (payload: SimVersionProblemPayload) => Error;
  readonly SIM_VERSION_UNKNOWN: (payload: SimVersionProblemPayload) => Error;
}

/**
 * Resolves the engine hash a new activity stamps. An absent `requested` (the transitional path,
 * before clients send a hash) stamps the registry's current version, throwing SIM_VERSION_UNKNOWN
 * on an empty registry. A `requested` hash stamps as-is when its row is `active` and retained;
 * SIM_VERSION_UNKNOWN when no row matches it, SIM_VERSION_EXPIRED when its row is `pruned` or past
 * `retainedUntil`. Both errors carry the registry's current hash (or null) so the client knows what
 * to resync onto.
 */
async function resolveSimVersionStamp(
  db: Kysely<DB>,
  requested: string | undefined,
  errors: SimVersionStampErrors,
): Promise<string> {
  if (requested === undefined) {
    const current = await findCurrentSimVersion(db);

    if (current === undefined) {
      throw errors.SIM_VERSION_UNKNOWN({ data: { currentSimVersion: null } });
    }

    return current.engineHash;
  }

  const version = await findSimVersion(db, requested);

  if (version !== undefined && version.status === 'active' && version.retainedUntil > new Date()) {
    return requested;
  }

  const current = await findCurrentSimVersion(db);

  const currentSimVersion = current?.engineHash ?? null;

  if (version === undefined) {
    throw errors.SIM_VERSION_UNKNOWN({ data: { currentSimVersion } });
  }

  throw errors.SIM_VERSION_EXPIRED({ data: { currentSimVersion } });
}

/**
 * Sums an avatar's settled xp with the xp delta of its terminal-but-unsettled activities — a
 * stopped, capped, quarantined, or parked activity whose verified anchor hasn't caught up to its
 * appended tail. The settled row and the pending set are read in one statement, so a concurrent
 * verifier commit can't land its delta in the gap between two separate reads. Malformed or
 * non-terminal tail payloads contribute nothing.
 */
async function getOptimisticXP(trx: Kysely<DB>, avatarID: string): Promise<number> {
  const rows = await trx
    .selectFrom('avatars')
    .leftJoin('activities', (join) =>
      join
        .onRef('activities.avatarId', '=', 'avatars.id')
        .on('activities.status', '!=', 'active')
        .on('activities.status', '!=', 'rejected')
        .onRef('activities.verifiedHead', '<', 'activities.appendedHead'),
    )
    .leftJoin('activityCheckpoints', (join) =>
      join
        .onRef('activityCheckpoints.activityId', '=', 'activities.id')
        .onRef('activityCheckpoints.version', '=', 'activities.appendedHead'),
    )
    .select(['avatars.xp', 'activityCheckpoints.payload'])
    .where('avatars.id', '=', avatarID)
    .execute();

  const [settled] = rows;

  invariant(
    settled !== undefined,
    'avatar must still exist inside the transaction that starts its activity',
  );

  return rows.reduce(
    (total, row) => total + (parseTerminalCheckpointXP(row.payload) ?? 0),
    settled.xp,
  );
}

/**
 * postgres.js surfaces a unique-constraint violation as SQLSTATE 23505.
 */
function isUniqueViolation(error: unknown): boolean {
  return typeof error === 'object' && error !== null && 'code' in error && error.code === '23505';
}
