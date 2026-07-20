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
import { submitStopIntent } from './submit-stop-intent';
import type { WorkerContext } from './types';

/**
 * Begins a run entirely inside the worker: the server start, the conflict recovery, and the
 * simulation install all run here, and the outcome broadcasts as a start status carrying the
 * request's id. A `CONFLICT` for the requested scope resyncs onto the already-active row instead
 * of failing; a `CONFLICT` for a different scope flushes that row's earned checkpoints, stops it
 * targeted, and retries the start — an avatar runs one activity at a time. Every await is
 * followed by a claim re-check: a fresher start request abandons this one (its own recovery
 * adopts or stops any row this one minted), and a player stop raised mid-start stops the minted
 * row back durably rather than installing a run that no longer exists.
 */
export async function handleStartActivityMessage(
  context: WorkerContext,
  message: StartActivityMessage,
): Promise<void> {
  context.setStartRequestID(message.requestID);

  const status = await runStart(context, message);

  emitStartStatus(context, message.requestID, status);
}

async function runStart(
  context: WorkerContext,
  message: StartActivityMessage,
): Promise<StartStatus> {
  const entryEpoch = context.getStopEpoch();

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
    return { kind: 'failed' };
  }

  const row = error.data.activity;

  // the requested scope is already running — the resync attaches its confirmed stream, with the
  // resync's own guards covering staleness and stops
  if (row.scopeType === message.scopeType && row.scopeID === message.scopeID) {
    await handleRequestResyncMessage(context, createRequestResyncMessage(message.avatarID));

    return { activityID: row.id, kind: 'attached' };
  }

  // a superseded request must not stop a row the fresher selection may be attaching to
  if (isSuperseded(context, message)) {
    return { kind: 'failed' };
  }

  // the replace flow: earned checkpoints land first — the server rejects appends onto a stopped
  // row — then the other scope's row stops targeted, so a raced newer row is never the casualty
  await context.getSubmitter().flushNow(row.id);

  const [stopError] = await safe(
    context.getClient().stopActivity({ activityID: row.id, avatarID: message.avatarID }),
  );

  if (stopError !== null && !(isDefinedError(stopError) && stopError.code === 'NOT_FOUND')) {
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
    return { kind: 'failed' };
  }

  return setLiveStartedRow(context, message, retried, entryEpoch);
}

async function setLiveStartedRow(
  context: WorkerContext,
  message: StartActivityMessage,
  row: Readonly<ActivityData>,
  entryEpoch: number,
): Promise<StartStatus> {
  // a stop that landed while the start was in flight owns the runtime — the fresh row is stopped
  // back durably, exactly as a player stop delivers
  if (hasStopIntervened(context, entryEpoch)) {
    await submitStopIntent(context, row);

    return { kind: 'failed' };
  }

  if (isSuperseded(context, message)) {
    return { kind: 'failed' };
  }

  // a worker that never saw an initialize has no simulation yet; the install must not silently
  // skip, or the tab would spin forever on a started run
  if (context.getSimulation() === null) {
    const simulation = createSimulation();

    registerSimulationListeners(context, simulation);

    context.setSimulation(simulation);
  }

  await handleSetActivityMessage(context, { activity: row, type: ClientMessageType.SetActivity });

  return { activity: row, kind: 'started' };
}

function isSuperseded(context: WorkerContext, message: StartActivityMessage): boolean {
  return context.getStartRequestID() !== message.requestID;
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
