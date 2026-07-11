import type { ActivityData, BuildSnapshot } from '@vers/contract-activity';
import type { Activities } from '@vers/db';
import type { Selectable } from 'kysely';

/**
 * Maps a kysely `activities` row (camelCase columns) onto the contract's `ActivityData` shape.
 * `buildSnapshot` is cast to `BuildSnapshot`: the column is untyped jsonb, but every write comes
 * from this service's own snapshot construction.
 */
// oxlint-disable-next-line typescript/prefer-readonly-parameter-types -- the row's jsonb `buildSnapshot` field types as the generated `Json` union, which nests a mutable `JsonValue[]` branch with no readonly form
export function toActivityData(row: Readonly<Selectable<Activities>>): ActivityData {
  return {
    appendedAt: row.appendedAt,
    appendedHead: row.appendedHead,
    avatarID: row.avatarId,
    // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- the column is untyped jsonb; every write is this service's own snapshot construction
    buildSnapshot: row.buildSnapshot as BuildSnapshot,
    contentVersion: row.contentVersion,
    createdAt: row.createdAt,
    id: row.id,
    lastHash: row.lastHash,
    nodeID: row.nodeId,
    seed: row.seed,
    simVersion: row.simVersion,
    startHash: row.startHash,
    startedAt: row.startedAt,
    status: row.status,
    stoppedAt: row.stoppedAt,
    updatedAt: row.updatedAt,
    verifiedAt: row.verifiedAt,
    verifiedHead: row.verifiedHead,
  };
}
