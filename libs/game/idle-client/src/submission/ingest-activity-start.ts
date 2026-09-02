import { isDefinedError, safe } from '@orpc/client';
import type { AdvanceCheckpointInvalidReason } from '@vers/contract-activity';
import { buildOfflineActivityStartSubmission } from '@vers/contract-activity';
import { readActivityStart } from './read-activity-start';
import { removeActivityStart } from './remove-activity-start';
import type { ActivityServiceClient } from './types';

export type IngestActivityStartOutcome =
  | 'absent'
  | 'deferred'
  | 'ingested'
  | 'rejected'
  | 'undelivered';

export type IngestActivityStartNotice =
  | { readonly activeAvatarName: string; readonly kind: 'avatar-switched' }
  | { readonly kind: 'sim-version-expired' };

export interface IngestActivityStartResult {
  readonly notice?: IngestActivityStartNotice;
  readonly outcome: IngestActivityStartOutcome;
}

const REJECTED_CODES: ReadonlySet<string> = new Set([
  'NODE_NOT_REVEALED',
  'NODE_UNKNOWN',
  'NOT_FOUND',
]);

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

  // the service never answered, so the row keeps and the caller has a connectivity transition to
  // make that a server-side deferral does not
  if (!isDefinedError(error)) {
    return { outcome: 'undelivered' };
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
