import { isDefinedError, safe } from '@orpc/client';
import type { ActivityData } from '@vers/contract-activity';
import { createSimulation } from '@vers/idle-core';
import type { StartActivityMessage, StartStatus } from '../types';
import { ClientMessageType } from '../types';
import { createRequestResyncMessage } from './create-request-resync-message';
import { createStartStatusMessage } from './create-start-status-message';
import { handleRequestResyncMessage } from './handle-request-resync-message';
import { handleSetActivityMessage } from './handle-set-activity-message';
import { hasStopIntervened } from './has-stop-intervened';
import { registerSimulationListeners } from './register-simulation-listeners';
import { reportWorkerFault } from './report-worker-fault';
import { submitStopIntent } from './submit-stop-intent';
import type { WorkerContext } from './types';

/**
 * Begins a run entirely inside the worker, broadcasting the outcome as a start status keyed by
 * the request id. A same-scope `CONFLICT` resyncs onto the running row and reports `attached`
 * only once the runtime holds it; a different-scope `CONFLICT` flushes that row, stops it
 * targeted, and retries. Flows run one at a time — the claim is taken at arrival, the flow waits
 * for its predecessor — so a stale flow can never stop a row a fresher one just attached. After
 * every await the claim is re-checked: a superseded flow reports `failed` and leaves its minted
 * row to the fresher flow's recovery; a stop landing mid-start stops the minted row back durably.
 */
export async function handleStartActivityMessage(
  context: WorkerContext,
  message: StartActivityMessage,
): Promise<void> {
  context.setStartRequestID(message.requestID);

  const previous = context.getStartFlow();

  // the flow settles without rejecting — a throw would strand every queued start behind it
  const flow = (async () => {
    await previous;

    try {
      const status = await runStart(context, message);

      emitStartStatus(context, message.requestID, status);
    } catch (error) {
      reportWorkerFault('start', error);
      emitStartStatus(context, message.requestID, { kind: 'failed' });
    }
  })();

  context.setStartFlow(flow);

  await flow;
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

  // the requested scope is already running — a resync attaches its confirmed stream
  if (row.scopeType === message.scopeType && row.scopeID === message.scopeID) {
    await handleRequestResyncMessage(context, createRequestResyncMessage(message.avatarID));

    // a resync can be skipped, gated, or abandoned without installing; reporting attached anyway
    // would leave the tab waiting forever on a run that never arrives
    if (context.getSimulation()?.activity?.id !== row.id) {
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

  const [stopError] = await safe(
    context.getClient().stopActivity({ activityID: row.id, avatarID: message.avatarID }),
  );

  if (stopError !== null && !(isDefinedError(stopError) && stopError.code === 'NOT_FOUND')) {
    if (!isDefinedError(stopError)) {
      reportWorkerFault('start', stopError);
    }

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

  // a worker that never saw an initialize has no simulation; a silently skipped install would
  // leave the tab spinning on a started run
  if (context.getSimulation() === null) {
    const simulation = createSimulation();

    registerSimulationListeners(context, simulation);

    context.setSimulation(simulation);
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
  const message = createStartStatusMessage(requestID, status);

  for (const connection of context.connections) {
    connection.postMessage(message);
  }
}
