import invariant from 'tiny-invariant';
import type { ActivityData } from './activity-data-schema';
import type { OfflineActivityStartSubmission } from './offline-activity-start-submission-schema';

export function buildOfflineActivityStartSubmission(
  row: Readonly<ActivityData>,
): OfflineActivityStartSubmission {
  // a locally minted activity start always carries the idempotency key it was minted with; only a
  // server-derived row's startKey can read null
  invariant(
    row.startKey !== null,
    'expected a client-minted activity start to carry its start key',
  );

  return {
    avatarID: row.avatarID,
    buildSnapshot: row.buildSnapshot,
    contentVersion: row.contentVersion,
    playedAt: row.playedAt,
    predecessorActivityID: row.predecessorActivityID,
    scopeID: row.scopeID,
    scopeType: row.scopeType,
    seed: row.seed,
    simVersion: row.simVersion,
    startChainIndex: row.startChainIndex,
    startHash: row.startHash,
    startKey: row.startKey,
  };
}
