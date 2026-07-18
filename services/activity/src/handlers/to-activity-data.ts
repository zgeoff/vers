import type { ActivityData, BuildSnapshot, EncounterNode } from '@vers/contract-activity';
import type { Activities } from '@vers/db';
import type { Selectable } from 'kysely';

/**
 * Maps a kysely `activities` row (camelCase columns) onto the contract's `ActivityData` shape.
 * `buildSnapshot` is cast to `BuildSnapshot`: the column is untyped jsonb, every write comes from
 * this service's own snapshot construction, and the cast cannot smuggle a drifted row past the RPC
 * boundary — oRPC validates handler output against the contract's output schema and fails the
 * request on mismatch.
 */
export function toActivityData(row: Readonly<Selectable<Activities>>): ActivityData {
  return {
    appendedAt: row.appendedAt,
    appendedHead: row.appendedHead,
    avatarID: row.avatarId,
    // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- the column is untyped jsonb; every write is this service's own snapshot construction, and oRPC's output validation rejects a drifted shape at the boundary
    buildSnapshot: row.buildSnapshot as BuildSnapshot,
    contentVersion: row.contentVersion,
    createdAt: row.createdAt,
    // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- the column is untyped jsonb; every write is this service's own encounter-node resolution, and oRPC's output validation rejects a drifted shape at the boundary
    encounterNode: row.encounterNode as EncounterNode,
    id: row.id,
    keyVersion: row.keyVersion,
    lastHash: row.lastHash,
    scopeID: row.scopeId,
    scopeType: row.scopeType,
    seed: row.seed,
    simVersion: row.simVersion,
    startChainIndex: row.startChainIndex,
    startHash: row.startHash,
    startedAt: row.startedAt,
    status: row.status,
    stoppedAt: row.stoppedAt,
    updatedAt: row.updatedAt,
    verifiedAt: row.verifiedAt,
    verifiedHead: row.verifiedHead,
  };
}
