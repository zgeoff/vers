import { isDefinedError, safe } from '@orpc/client';
import { buildOfflineRootSubmission } from '@vers/contract-activity';
import { readStartRow } from './read-start-row';
import { removeStartRow } from './remove-start-row';
import type { ActivityServiceClient } from './types';

/**
 * `ingestStartRow`'s settled outcome: `ingested` when the server minted the root and this
 * device's durable row is gone; `deferred` when the answer says nothing about the root's own
 * validity — a transport failure, a session lapse, or a temporarily inactive avatar — and the row
 * stays for a later retry; `rejected` when the server refused the root outright and the row is
 * gone; `absent` when this device held no pending root for the activity id at all.
 */
export type IngestStartRowOutcome = 'absent' | 'deferred' | 'ingested' | 'rejected';

/**
 * A defined `advanceActivity` error naming the root permanently invalid — a scope that resolves to
 * no node, a chain that was never revealed, or a sim version past retention. The server will refuse
 * it under any order, so the pending row is dropped along with the checkpoints that would have
 * chained onto it. The order-sensitive refusals — `CONFLICT` (the predecessor's terminal has not
 * advanced the chain head yet), `CHECKPOINT_INVALID` (the predecessor's xp is not in the server's
 * total yet), `SIM_VERSION_UNKNOWN` (a version registration this deploy has not caught up to), and
 * `CHAIN_QUARANTINED` (an operator hold) — are absent here on purpose: each resolves once the
 * predecessor lands or the hold clears, so the row defers and retries rather than dropping honest
 * progress.
 */
const REJECTED_CODES: ReadonlySet<string> = new Set([
  'NODE_NOT_REVEALED',
  'NODE_UNKNOWN',
  'NOT_FOUND',
  'SIM_VERSION_EXPIRED',
]);

/**
 * Submits one device's client-minted root into the server through `advanceActivity`'s
 * offline-first ingest, an empty `continuations` batch minting the row alone and appending
 * nothing. Removes the durable `pending-roots` row once the server has answered definitively —
 * accepted or refused — and keeps it untouched on anything that says nothing about the root's own
 * validity, so a later retry gets another chance.
 */
export async function ingestStartRow(
  client: Pick<ActivityServiceClient, 'advanceActivity'>,
  activityID: string,
): Promise<IngestStartRowOutcome> {
  const row = await readStartRow(activityID);

  if (row === undefined) {
    return 'absent';
  }

  // a client-minted root always carries its start key; a row missing one can never be projected
  // into a submission, so drop it rather than let the projection throw and abort a multi-row drain
  if (row.startKey === null) {
    await removeStartRow(activityID);

    return 'rejected';
  }

  const root = buildOfflineRootSubmission(row);

  const [error] = await safe(
    client.advanceActivity({ activityID, continuations: [], expectedHead: 0, root }),
  );

  if (error === null) {
    await removeStartRow(activityID);

    return 'ingested';
  }

  if (isDefinedError(error) && REJECTED_CODES.has(error.code)) {
    await removeStartRow(activityID);

    return 'rejected';
  }

  return 'deferred';
}
