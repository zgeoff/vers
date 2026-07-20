import { safe } from '@orpc/client';
import { writeFailureActionCache } from '../submission/write-failure-action-cache';
import type { SetFailureActionMessage } from '../types';
import { createFailureActionStatusMessage } from './create-failure-action-status-message';
import type { WorkerContext } from './types';

/**
 * Applies a tab's failure-action change. The synchronous in-memory effects land first, before any
 * await, so a slow persistence or push never delays them: the context's in-session value updates,
 * a live simulation adopts it directly, and every connection hears the effective value. The
 * device-local cache then records it dirty as an offline outbox entry, and finally the value is
 * pushed to the server. The push is single-flight per worker: a change arriving while a push runs
 * coalesces onto it — the running loop re-reads the context and pushes the newest value — so an
 * older push's acknowledgement can never clear the dirty flag or cache a value already superseded.
 * Delivery is best-effort: a connectivity failure leaves the cache dirty for the next resync's
 * reconcile to retry.
 */
export async function handleSetFailureActionMessage(
  context: WorkerContext,
  message: SetFailureActionMessage,
): Promise<void> {
  context.setFailureAction(message.failureAction);
  context.setFailureActionDirty(true);
  context.getSimulation().setFailureAction(message.failureAction);

  const statusMessage = createFailureActionStatusMessage(message.failureAction);

  for (const connection of context.connections) {
    connection.postMessage(statusMessage);
  }

  await writeFailureActionCache({
    avatarID: message.avatarID,
    dirty: true,
    failureAction: message.failureAction,
  });

  if (context.isFailureActionPushInFlight()) {
    return;
  }

  context.setFailureActionPushInFlight(true);

  try {
    await flushFailureAction(context, message.avatarID);
  } finally {
    context.setFailureActionPushInFlight(false);
  }
}

/**
 * Delivers the context's current failure action to the server as the offline outbox's one entry,
 * looping until the value it confirmed still matches the context — a change that arrives mid-flight
 * is picked up and delivered again, so the dirty flag clears only for a value the server actually
 * holds. A delivery failure leaves the value dirty and ends the loop for the next resync's
 * reconcile to retry.
 */
async function flushFailureAction(context: WorkerContext, avatarID: string): Promise<void> {
  let pushed = context.getFailureAction();
  let confirmed = false;

  while (!confirmed) {
    const [error] = await safe(
      context.getClient().updateFailureAction({ avatarID, failureAction: pushed }),
    );

    if (error !== null) {
      return;
    }

    const current = context.getFailureAction();

    if (current === pushed) {
      context.setFailureActionDirty(false);

      await writeFailureActionCache({ avatarID, dirty: false, failureAction: pushed });

      confirmed = true;
    } else {
      pushed = current;
    }
  }
}
