import {
  BuildSnapshotSchema,
  CheckpointPayloadSchema,
  EncounterNodeSchema,
} from '@vers/contract-activity';
import type { DB } from '@vers/db';
import type { Kysely } from 'kysely';
import invariant from 'tiny-invariant';
import type { ReplayTarget } from '../types';
import type { ReplaySegment } from './types';

export async function loadReplaySegment(
  db: Kysely<DB>,
  target: Readonly<ReplayTarget>,
): Promise<ReplaySegment | undefined> {
  const activity = await db
    .selectFrom('activities')
    .select([
      'appendedTimeMs',
      'avatarId',
      'buildSnapshot',
      'contentVersion',
      'encounterNode',
      'id',
      'keyVersion',
      'scopeId',
      'scopeType',
      'secretRef',
      'secretVersion',
      'seed',
      'settledXp',
      'simVersion',
      'startChainIndex',
      'startHash',
      'status',
    ])
    .where('id', '=', target.activityID)
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

  invariant(chain !== undefined, 'a target activity always has an owning chain row');

  const rows = await db
    .selectFrom('activityCheckpoints')
    .select(['appendedAt', 'hash', 'payload', 'prevHash', 'version'])
    .where('activityId', '=', target.activityID)
    .where('version', '<=', target.appendedHead)
    .orderBy('version')
    .execute();

  const checkpoints = rows.map((row) => ({
    appendedAt: row.appendedAt,
    hash: row.hash,
    payload: CheckpointPayloadSchema.parse(row.payload),
    prevHash: row.prevHash,
    version: row.version,
  }));

  const predecessor = target.verifiedHead === 0 ? undefined : checkpoints[target.verifiedHead - 1];

  invariant(
    target.verifiedHead === 0 || predecessor?.version === target.verifiedHead,
    'a verified head always has a stored checkpoint row at its own version',
  );

  return {
    activity: {
      appendedHead: target.appendedHead,
      appendedTimeMs: Number(activity.appendedTimeMs),
      avatarID: activity.avatarId,
      buildSnapshot: BuildSnapshotSchema.parse(activity.buildSnapshot),
      contentVersion: activity.contentVersion,
      encounterNode: EncounterNodeSchema.parse(activity.encounterNode),
      id: activity.id,
      keyVersion: activity.keyVersion,
      scopeID: activity.scopeId,
      scopeType: activity.scopeType,
      secretRef: activity.secretRef,
      secretVersion: activity.secretVersion,
      seed: activity.seed,
      settledXP: activity.settledXp,
      simVersion: activity.simVersion,
      startChainIndex: activity.startChainIndex,
      status: activity.status,
    },
    chain,
    checkpoints,
    prevHash: predecessor === undefined ? activity.startHash : predecessor.hash,
    seed: predecessor === undefined ? activity.seed : predecessor.payload.nextSeed,
    verifiedHead: target.verifiedHead,
  };
}
