import { isDefinedError, safe } from '@orpc/client';
import { readPendingStartIntent } from '../submission/read-pending-start-intent';
import { removePendingStartIntent } from '../submission/remove-pending-start-intent';
import { createConnectionStatusMessage } from './create-connection-status-message';
import { createOfflineCapStatusMessage } from './create-offline-cap-status-message';
import { reportWorkerFault } from './report-worker-fault';
import type { WorkerContext } from './types';

export type PendingStartFlushOutcome = 'delivered' | 'held' | 'none';

/**
 * Attempts delivery of the held start intent — a continuation raised against a closing row,
 * idempotent through its start key. A spent offline budget holds the intent and broadcasts the
 * cap. A `CONFLICT` naming the intent's own target means the terminal append hasn't drained yet,
 * so the intent stays held; a `CONFLICT` naming any other claim moots it — the resync that
 * follows reconciles onto that claim. Any other defined rejection drops the intent as
 * undeliverable and reports the fault; a transport failure holds it and reports the worker
 * offline. Delivery only mints the server row: the resync that runs next attaches it.
 */
export async function flushPendingStart(context: WorkerContext): Promise<PendingStartFlushOutcome> {
  const intent = await readPendingStartIntent();

  if (intent === undefined) {
    return 'none';
  }

  if (context.getRemainingBudgetMs() <= 0) {
    emitCapStatus(context);

    return 'held';
  }

  const [error] = await safe(
    context.getClient().startActivity({
      avatarID: intent.avatarID,
      scopeID: intent.scopeID,
      scopeType: intent.scopeType,
      startKey: intent.startKey,
    }),
  );

  if (error === null) {
    await removePendingStartIntent(intent.startKey);

    return 'delivered';
  }

  if (isDefinedError(error) && error.code === 'CONFLICT') {
    if (`continue_${error.data.activity.id}` === intent.startKey) {
      return 'held';
    }

    await removePendingStartIntent(intent.startKey);

    return 'none';
  }

  // an expired or insufficient session is expected behavior with one remedy — a fresh sign-in —
  // so the intent survives it, exactly as it survives a transport failure
  if (isDefinedError(error) && (error.code === 'UNAUTHORIZED' || error.code === 'FORBIDDEN')) {
    return 'held';
  }

  if (isDefinedError(error)) {
    reportWorkerFault('start', error);

    await removePendingStartIntent(intent.startKey);

    return 'none';
  }

  emitConnectionStatus(context, false);

  return 'held';
}

function emitCapStatus(context: WorkerContext): void {
  const message = createOfflineCapStatusMessage(0, true);

  for (const connection of context.connections) {
    connection.postMessage(message);
  }
}

function emitConnectionStatus(context: WorkerContext, online: boolean): void {
  const message = createConnectionStatusMessage(online);

  for (const connection of context.connections) {
    connection.postMessage(message);
  }
}
