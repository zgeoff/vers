import invariant from 'tiny-invariant';
import type { ActivityData } from './activity-data-schema';
import type { OfflineRootSubmission } from './offline-root-submission-schema';

/**
 * Projects a locally minted root row down to the wire fields `advanceActivity` accepts for
 * offline-first ingest — every field the server re-derives (`encounterNode`, `keyVersion`,
 * `secretRef`, `secretVersion`) is dropped, since the row's own values for them were never
 * server-authoritative to begin with.
 */
export function buildOfflineRootSubmission(row: Readonly<ActivityData>): OfflineRootSubmission {
  // a locally minted root always carries the idempotency key it was minted with; only a
  // server-derived row's startKey can read null
  invariant(row.startKey !== null, 'expected a client-minted root row to carry its start key');

  return {
    avatarID: row.avatarID,
    buildSnapshot: row.buildSnapshot,
    contentVersion: row.contentVersion,
    scopeID: row.scopeID,
    scopeType: row.scopeType,
    seed: row.seed,
    simVersion: row.simVersion,
    startChainIndex: row.startChainIndex,
    startHash: row.startHash,
    startKey: row.startKey,
  };
}
