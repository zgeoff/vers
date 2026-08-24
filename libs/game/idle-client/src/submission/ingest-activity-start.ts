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
 * A refusal the player must be told about, carried out alongside the disposition it earned: the
 * account switched active avatars while this device held the activity start, or the service
 * confirmed this build's engine no longer replays the current content. Absent for every other
 * answer, including the refusals a later retry can clear on its own.
 */
export type IngestActivityStartNotice =
  | { readonly activeAvatarName: string; readonly kind: 'avatar-switched' }
  | { readonly kind: 'sim-version-expired' };

/**
 * One ingest's disposition, plus the player-facing notice it owes when the server refused on
 * grounds a player can act on.
 */
export interface IngestActivityStartResult {
  readonly notice?: IngestActivityStartNotice;
  readonly outcome: IngestActivityStartOutcome;
}

/**
 * A defined `advanceActivity` error naming the activity start permanently invalid — a scope that
 * resolves to no node, or a seed chain that was never revealed. A sim version past retention is
 * equally permanent but answered separately, since it owes the player a notice as well. The
 * server will refuse it under any order, so the pending row is dropped along with the checkpoints
 * that would have chained onto it. The order-sensitive refusals — `CONFLICT` (the predecessor's
 * terminal has not advanced the seed chain's anchor yet), `SIM_VERSION_UNKNOWN` (a version
 * registration this deploy has not caught up to), and `CHAIN_QUARANTINED` (an operator hold) — are
 * absent here on purpose: each resolves once the predecessor lands or the hold clears, so the row
 * defers and retries rather than dropping honest progress. `CHECKPOINT_INVALID` is absent for a
 * different reason: some of its reasons drop the row and some defer it, so each reason carries its
 * own disposition.
 */
const REJECTED_CODES: ReadonlySet<string> = new Set([
  'NODE_NOT_REVEALED',
  'NODE_UNKNOWN',
  'NOT_FOUND',
]);

/**
 * What a start ingest does with each `CHECKPOINT_INVALID` reason: keep the durable row for a later
 * retry, or drop it. A permanent reason drops the row, since retrying only resubmits the same
 * refusal. A deferral assumes the caller's earlier runs still reach the server, so a row whose
 * simulation genuinely diverged from the server's retries for the life of the store.
 *
 * The map covers every member of the contract's reason enum. Adding a member there breaks this
 * map's type until the new member gets a disposition.
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
 * start's own validity, so a later retry gets another chance. Two refusals also carry a notice for
 * the player: the account switched active avatars, and this build's engine is past retention.
 */
export async function ingestActivityStart(
  client: Pick<ActivityServiceClient, 'advanceActivity'>,
  activityID: string,
): Promise<IngestActivityStartResult> {
  const row = await readActivityStart(activityID);

  if (row === undefined) {
    return { outcome: 'absent' };
  }

  // a client-minted activity start always carries its start key; a row missing one can never be
  // projected into a submission, so drop it rather than let the projection throw and abort a
  // multi-row drain
  if (row.startKey === null) {
    await removeActivityStart(activityID);

    return { outcome: 'rejected' };
  }

  const activityStart = buildOfflineActivityStartSubmission(row);

  const [error] = await safe(
    client.advanceActivity({ activityID, continuations: [], expectedHead: 0, activityStart }),
  );

  if (error === null) {
    await removeActivityStart(activityID);

    return { outcome: 'ingested' };
  }

  if (!isDefinedError(error)) {
    return { outcome: 'deferred' };
  }

  if (error.code === 'CHECKPOINT_INVALID') {
    if (CHECKPOINT_INVALID_DISPOSITIONS[error.data.reason] === 'deferred') {
      return { outcome: 'deferred' };
    }

    await removeActivityStart(activityID);

    return { outcome: 'rejected' };
  }

  // the account switched avatars while this device held the activity start: the row keeps for a
  // switch back, and the player is told which avatar the account is on now
  if (error.code === 'AVATAR_NOT_ACTIVE') {
    return {
      notice: { activeAvatarName: error.data.activeAvatarName, kind: 'avatar-switched' },
      outcome: 'deferred',
    };
  }

  // only a reload delivers an engine the service would accept, so the row goes with the notice
  if (error.code === 'SIM_VERSION_EXPIRED') {
    await removeActivityStart(activityID);

    return { notice: { kind: 'sim-version-expired' }, outcome: 'rejected' };
  }

  if (REJECTED_CODES.has(error.code)) {
    await removeActivityStart(activityID);

    return { outcome: 'rejected' };
  }

  return { outcome: 'deferred' };
}
