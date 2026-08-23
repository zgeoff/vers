import { isDefinedError, safe } from '@orpc/client';
import type { AdvanceCheckpointInvalidReason } from '@vers/contract-activity';
import { buildOfflineActivityStartSubmission } from '@vers/contract-activity';
import { readActivityStart } from './read-activity-start';
import { removeActivityStart } from './remove-activity-start';
import type { ActivityServiceClient } from './types';

/**
 * `ingestActivityStart`'s settled outcome: `ingested` when the server minted the activity start and
 * this device's durable row is gone; `deferred` when the answer says nothing about the activity
 * start's own validity — a transport failure, a session lapse, or a temporarily inactive avatar —
 * and the row stays for a later retry; `rejected` when the server refused the activity start
 * outright and the row is gone; `absent` when this device held no pending activity start for the
 * activity id at all.
 */
export type IngestActivityStartOutcome = 'absent' | 'deferred' | 'ingested' | 'rejected';

/**
 * A defined `advanceActivity` error naming the activity start permanently invalid — a scope that
 * resolves to no node, a seed chain that was never revealed, or a sim version past retention. The
 * server will refuse it under any order, so the pending row is dropped along with the checkpoints
 * that would have chained onto it. The order-sensitive refusals — `CONFLICT` (the predecessor's
 * terminal has not advanced the seed chain's anchor yet), `SIM_VERSION_UNKNOWN` (a version
 * registration this deploy has not caught up to), and `CHAIN_QUARANTINED` (an operator hold) — are
 * absent here on purpose: each resolves once the predecessor lands or the hold clears, so the row
 * defers and retries rather than dropping honest progress. `CHECKPOINT_INVALID` carries both
 * dispositions and is split by reason instead.
 */
const REJECTED_CODES: ReadonlySet<string> = new Set([
  'NODE_NOT_REVEALED',
  'NODE_UNKNOWN',
  'NOT_FOUND',
  'SIM_VERSION_EXPIRED',
]);

/**
 * Each `CHECKPOINT_INVALID` reason's disposition for a start ingest. `build-snapshot-mismatch` is
 * the sole deferral: the predecessor's xp is not in the server's total yet, and the same submission
 * succeeds once it lands. Every other reason describes bytes the server refuses under any order, so
 * retrying resubmits the same refusal forever and the row is dropped instead.
 *
 * The map is total over the contract's reason enum, so a reason added to the contract fails to
 * compile here until its disposition is stated.
 */
const CHECKPOINT_INVALID_DISPOSITIONS: Readonly<
  Record<AdvanceCheckpointInvalidReason, 'deferred' | 'rejected'>
> = {
  'broken-chain-link': 'rejected',
  'build-snapshot-mismatch': 'deferred',
  'continuation-not-terminal': 'rejected',
  'hash-mismatch': 'rejected',
  'invalid-reward-slots': 'rejected',
  'invalid-rewards': 'rejected',
  'non-contiguous-chain-index': 'rejected',
  'non-contiguous-versions': 'rejected',
  'non-integer-time': 'rejected',
  'start-hash-mismatch': 'rejected',
  'terminal-not-last': 'rejected',
  'time-regression': 'rejected',
};

/**
 * Submits one device's client-minted activity start into the server through `advanceActivity`'s
 * offline-first ingest, an empty `continuations` batch minting the row alone and appending nothing.
 * Removes the durable `pending-activity-starts` row once the server has answered definitively —
 * accepted or refused — and keeps it untouched on anything that says nothing about the activity
 * start's own validity, so a later retry gets another chance.
 */
export async function ingestActivityStart(
  client: Pick<ActivityServiceClient, 'advanceActivity'>,
  activityID: string,
): Promise<IngestActivityStartOutcome> {
  const row = await readActivityStart(activityID);

  if (row === undefined) {
    return 'absent';
  }

  // a client-minted activity start always carries its start key; a row missing one can never be
  // projected into a submission, so drop it rather than let the projection throw and abort a
  // multi-row drain
  if (row.startKey === null) {
    await removeActivityStart(activityID);

    return 'rejected';
  }

  const activityStart = buildOfflineActivityStartSubmission(row);

  const [error] = await safe(
    client.advanceActivity({ activityID, continuations: [], expectedHead: 0, activityStart }),
  );

  if (error === null) {
    await removeActivityStart(activityID);

    return 'ingested';
  }

  if (!isDefinedError(error)) {
    return 'deferred';
  }

  if (error.code === 'CHECKPOINT_INVALID') {
    if (CHECKPOINT_INVALID_DISPOSITIONS[error.data.reason] === 'deferred') {
      return 'deferred';
    }

    await removeActivityStart(activityID);

    return 'rejected';
  }

  if (REJECTED_CODES.has(error.code)) {
    await removeActivityStart(activityID);

    return 'rejected';
  }

  return 'deferred';
}
