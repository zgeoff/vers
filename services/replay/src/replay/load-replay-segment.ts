import type { CheckpointPayload } from '@vers/contract-activity';
import type { DB } from '@vers/db';
import type { Kysely } from 'kysely';
import invariant from 'tiny-invariant';
import type { ReplayFrontier } from '../types';
import type { ReplaySegment } from './types';

/**
 * Reads one frontier activity's replay unit: its own row, its chain row, and every stored
 * checkpoint from version 1 through `appendedHead` — the whole stream, not just the unverified
 * tail, because a cache-miss rebuild must replay every earlier local attempt's own boundary to
 * read the stream's later `time` values correctly. Undefined when the activity row is gone (raced
 * against a concurrent cleanup) — the caller treats that as nothing to replay.
 */
export async function loadReplaySegment(
  db: Kysely<DB>,
  frontier: Readonly<ReplayFrontier>,
): Promise<ReplaySegment | undefined> {
  const activity = await db
    .selectFrom('activities')
    .select([
      'appendedTimeMs',
      'avatarId',
      'buildSnapshot',
      'contentVersion',
      'id',
      'keyVersion',
      'scopeId',
      'scopeType',
      'seed',
      'simVersion',
      'startChainIndex',
      'startHash',
    ])
    .where('id', '=', frontier.activityID)
    .executeTakeFirst();

  if (activity === undefined) {
    return undefined;
  }

  const chain = await db
    .selectFrom('activityChains')
    .select(['genesisSeed', 'verifiedChainIndex', 'verifiedNextSeed'])
    .where('avatarId', '=', activity.avatarId)
    .where('scopeType', '=', activity.scopeType)
    .where('scopeId', '=', activity.scopeId)
    .executeTakeFirst();

  invariant(chain !== undefined, 'a frontier activity always has an owning chain row');

  const rows = await db
    .selectFrom('activityCheckpoints')
    .select(['hash', 'payload', 'prevHash', 'version'])
    .where('activityId', '=', frontier.activityID)
    .where('version', '<=', frontier.appendedHead)
    .orderBy('version')
    .execute();

  const predecessor = frontier.verifiedHead === 0 ? undefined : rows[frontier.verifiedHead - 1];

  invariant(
    frontier.verifiedHead === 0 || predecessor?.version === frontier.verifiedHead,
    'a verified head always has a stored checkpoint row at its own version',
  );

  return {
    activity: {
      appendedTimeMs: Number(activity.appendedTimeMs),
      avatarID: activity.avatarId,
      buildSnapshot: readBuildSnapshot(activity.buildSnapshot),
      contentVersion: activity.contentVersion,
      id: activity.id,
      keyVersion: activity.keyVersion,
      scopeID: activity.scopeId,
      scopeType: activity.scopeType,
      seed: activity.seed,
      simVersion: activity.simVersion,
      startChainIndex: activity.startChainIndex,
    },
    chain,
    checkpoints: rows.map((row) => ({
      hash: row.hash,
      // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- the column is untyped jsonb; every write is schema-validated contract input
      payload: row.payload as CheckpointPayload,
      prevHash: row.prevHash,
      version: row.version,
    })),
    prevHash: predecessor === undefined ? activity.startHash : predecessor.hash,
    seed:
      predecessor === undefined
        ? activity.seed
        : readPayloadNextSeed(
            // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- the column is untyped jsonb; every write is schema-validated contract input
            predecessor.payload as CheckpointPayload,
          ),
    verifiedHead: frontier.verifiedHead,
  };
}

/**
 * The activities row's `build_snapshot` column is untyped jsonb; every write is schema-validated
 * contract input (`BuildSnapshotSchema`), so this reads its two known fields without re-validating.
 */
function readBuildSnapshot(value: unknown): { level: number; xp: number } {
  // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- the column is untyped jsonb; every write is schema-validated contract input
  const snapshot = value as { level: number; xp: number };

  return { level: snapshot.level, xp: snapshot.xp };
}

function readPayloadNextSeed(payload: Readonly<CheckpointPayload>): string {
  return payload.nextSeed;
}
