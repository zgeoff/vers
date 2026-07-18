import { safe } from '@orpc/client';
import { writeFailureActionCache } from '../submission/write-failure-action-cache';
import type { SetFailureActionMessage } from '../types';
import { createFailureActionStatusMessage } from './create-failure-action-status-message';
import type { WorkerContext } from './types';

/**
 * Applies a tab's failure-action change: the context's in-session value updates first, so every
 * derivation reads the new preference immediately, then the device-local cache marks it dirty as
 * an offline outbox entry. A live simulation adopts it directly rather than waiting for its next
 * continuation. The server push is best-effort — a connectivity failure leaves the cache dirty for
 * the next resync's reconcile to retry — and every connection hears the effective value regardless
 * of whether the push landed.
 */
export async function handleSetFailureActionMessage(
  context: WorkerContext,
  message: SetFailureActionMessage,
): Promise<void> {
  context.setFailureAction(message.failureAction);
  context.setFailureActionDirty(true);

  await writeFailureActionCache({ dirty: true, failureAction: message.failureAction });

  context.getSimulation()?.setFailureAction(message.failureAction);
  const avatarID = context.getResyncAvatarID();

  if (avatarID !== null) {
    const [error] = await safe(
      context.getClient().updateFailureAction({ avatarID, failureAction: message.failureAction }),
    );

    if (error === null) {
      context.setFailureActionDirty(false);

      await writeFailureActionCache({ dirty: false, failureAction: message.failureAction });
    }
  }

  const statusMessage = createFailureActionStatusMessage(message.failureAction);

  for (const connection of context.connections) {
    connection.postMessage(statusMessage);
  }
}
