import type { ActivityData } from '@vers/contract-activity';
import { BuildSnapshotSchema, EncounterNodeSchema } from '@vers/contract-activity';
import type { Activities } from '@vers/db';
import type { Selectable } from 'kysely';

/**
 * Maps a kysely `activities` row (camelCase columns) onto the contract's `ActivityData` shape.
 * `buildSnapshot` and `encounterNode` are untyped jsonb columns and re-enter typed code through
 * their contract schemas, so a drifted row fails here loudly instead of flowing on.
 */
export function toActivityData(row: Readonly<Selectable<Activities>>): ActivityData {
  return {
    appendedAt: row.appendedAt,
    appendedHead: row.appendedHead,
    avatarID: row.avatarId,
    buildSnapshot: BuildSnapshotSchema.parse(row.buildSnapshot),
    contentVersion: row.contentVersion,
    createdAt: row.createdAt,
    encounterNode: EncounterNodeSchema.parse(row.encounterNode),
    id: row.id,
    keyVersion: row.keyVersion,
    lastHash: row.lastHash,
    playedAt: row.playedAt,
    predecessorActivityID: row.predecessorActivityId,
    scopeID: row.scopeId,
    scopeType: row.scopeType,
    secretRef: row.secretRef,
    secretVersion: row.secretVersion,
    seed: row.seed,
    simVersion: row.simVersion,
    startChainIndex: row.startChainIndex,
    startHash: row.startHash,
    startKey: row.startKey,
    startedAt: row.startedAt,
    status: row.status,
    stoppedAt: row.stoppedAt,
    updatedAt: row.updatedAt,
    verifiedAt: row.verifiedAt,
    verifiedHead: row.verifiedHead,
  };
}
