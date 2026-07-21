import { isDefinedError, safe } from '@orpc/client';
import type { ActivityData } from '@vers/contract-activity';
import { ClientMessageType, WorkerMessageType } from '../types';
import type { StartActivityMessage } from './client-to-worker-message-schema';
import { handleSetActivityMessage } from './handle-set-activity-message';
import { hasStopIntervened } from './has-stop-intervened';
import { reportWorkerFault } from './report-worker-fault';
import { runResyncFlow } from './run-resync-flow';
import { submitStopIntent } from './submit-stop-intent';
import type { WorkerContext } from './types';
import { withLifecycleTurn } from './with-lifecycle-turn';
import type { StartStatus, WorkerMessage } from './worker-to-client-message-schema';

/**
 * Begins a run entirely inside the worker, broadcasting the outcome as a start status keyed by
 * the request id. A same-scope `CONFLICT` resyncs onto the running row, reporting `attached`
 * only once the runtime holds it; a different-scope `CONFLICT` flushes that row, stops it
 * targeted, and retries. The claim is taken at arrival and re-checked after every await — a
 * fresher request can land while this turn runs, and a superseded flow reports `failed`, leaving
 * its minted row to the fresher flow's recovery. A stop landing mid-start stops the minted row
 * back durably.
 */
export async function handleStartActivityMessage(
  context: WorkerContext,
  message: StartActivityMessage,
): Promise<void> {
  context.setStartRequestID(message.requestID);

  await withLifecycleTurn(context, 'start', async () => {
    // failures settle as a failed status rather than escaping into the mailbox's fault report —
    // a tab is always waiting on this request id
    try {
      const status = await runStart(context, message);

      emitStartStatus(context, message.requestID, status);
    } catch (error) {
      reportWorkerFault('start', error);
      emitStartStatus(context, message.requestID, { kind: 'failed' });
    }
  });
}

async function runStart(
  context: WorkerContext,
  message: StartActivityMessage,
): Promise<StartStatus> {
  const entryEpoch = context.getStopEpoch();

  // a queued flow may be stale before it ever runs
  if (isSuperseded(context, message) || hasStopIntervened(context, entryEpoch)) {
    return { kind: 'failed' };
  }

  const [error, started] = await safe(
    context.getClient().startActivity({
      avatarID: message.avatarID,
      scopeID: message.scopeID,
      scopeType: message.scopeType,
      startKey: message.requestID,
    }),
  );

  if (error === null) {
    return setLiveStartedRow(context, message, started, entryEpoch);
  }

  if (!isDefinedError(error) || error.code !== 'CONFLICT') {
    // a defined rejection is the service answering; anything else belongs in the error backend
    if (!isDefinedError(error)) {
      reportWorkerFault('start', error);
    }

    return { kind: 'failed' };
  }

  const row = error.data.activity;

  // the requested scope is already running — a resync attaches its confirmed stream, claiming
  // the writer since the player's start is a deliberate attach; called inner-to-inner, since
  // queueing a turn from inside this turn would deadlock the mailbox
  if (row.scopeType === message.scopeType && row.scopeID === message.scopeID) {
    await runResyncFlow(context, message.avatarID, true, entryEpoch);

    // a resync can be skipped, gated, or abandoned without installing; reporting attached anyway
    // would leave the tab waiting forever on a run that never arrives
    if (context.getSimulation().activity?.id !== row.id) {
      return { kind: 'failed' };
    }

    return { activityID: row.id, kind: 'attached' };
  }

  // a superseded request must not stop a row the fresher selection may be attaching to
  if (isSuperseded(context, message)) {
    return { kind: 'failed' };
  }

  // replace flow: earned checkpoints land before the stop closes the row to appends
  await context.getSubmitter().flushNow(row.id);

  if (!(await stopConflictingRow(context, row.id, message.avatarID))) {
    return { kind: 'failed' };
  }

  const [retryError, retried] = await safe(
    context.getClient().startActivity({
      avatarID: message.avatarID,
      scopeID: message.scopeID,
      scopeType: message.scopeType,
      startKey: message.requestID,
    }),
  );

  if (retryError !== null) {
    if (!isDefinedError(retryError)) {
      reportWorkerFault('start', retryError);
    }

    return { kind: 'failed' };
  }

  return setLiveStartedRow(context, message, retried, entryEpoch);
}

function isSuperseded(context: WorkerContext, message: StartActivityMessage): boolean {
  return context.getStartRequestID() !== message.requestID;
}

/**
 * Stops the different-scope row a replace-flow start conflicts with, reporting whether the row is
 * closed to further appends. A stop rejected with SESSION_EVICTED means another session's writer
 * owns the run — the player's start here is a deliberate act that supersedes it, so this session
 * claims the writer and retries the stop once. A claim answering NOT_FOUND means the row already
 * left `active`, which is all a stop could have achieved.
 */
async function stopConflictingRow(
  context: WorkerContext,
  activityID: string,
  avatarID: string,
): Promise<boolean> {
  const [stopError] = await safe(context.getClient().stopActivity({ activityID, avatarID }));

  if (stopError === null || (isDefinedError(stopError) && stopError.code === 'NOT_FOUND')) {
    return true;
  }

  if (!isDefinedError(stopError)) {
    reportWorkerFault('start', stopError);

    return false;
  }

  if (stopError.code !== 'SESSION_EVICTED') {
    return false;
  }

  const [claimError] = await safe(context.getClient().resumeActivity({ activityID }));

  if (claimError !== null) {
    if (isDefinedError(claimError) && claimError.code === 'NOT_FOUND') {
      return true;
    }

    if (!isDefinedError(claimError)) {
      reportWorkerFault('start', claimError);
    }

    return false;
  }

  const [retryError] = await safe(context.getClient().stopActivity({ activityID, avatarID }));

  if (retryError === null || (isDefinedError(retryError) && retryError.code === 'NOT_FOUND')) {
    return true;
  }

  if (!isDefinedError(retryError)) {
    reportWorkerFault('start', retryError);
  }

  return false;
}

async function setLiveStartedRow(
  context: WorkerContext,
  message: StartActivityMessage,
  row: Readonly<ActivityData>,
  entryEpoch: number,
): Promise<StartStatus> {
  // a stop landed mid-start: the fresh row is stopped back durably, as any player stop delivers
  if (hasStopIntervened(context, entryEpoch)) {
    await submitStopIntent(context, row);

    return { kind: 'failed' };
  }

  if (isSuperseded(context, message)) {
    return { kind: 'failed' };
  }

  await handleSetActivityMessage(context, { activity: row, type: ClientMessageType.SetActivity });

  // the install's registration await is this flow's last yield; a request that arrived during it
  // owns the claim, and its queued flow will replace this install
  if (isSuperseded(context, message)) {
    return { kind: 'failed' };
  }

  return { activity: row, kind: 'started' };
}

function emitStartStatus(
  context: WorkerContext,
  requestID: string,
  status: Readonly<StartStatus>,
): void {
  const message = {
    requestID,
    status,
    type: WorkerMessageType.StartStatus,
  } satisfies WorkerMessage;

  for (const connection of context.connections) {
    connection.postMessage(message);
  }
}
