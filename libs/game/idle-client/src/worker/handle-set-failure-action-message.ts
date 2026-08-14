import { safe } from '@orpc/client';
import type { ActivityFailureAction } from '@vers/idle-core';
import { writeFailureActionCache } from '../submission/write-failure-action-cache';
import { WorkerMessageType } from '../types';
import type { WorkerContext } from './types';
import type { WorkerMessage } from './worker-to-client-message-schema';

interface SetFailureActionInput {
  readonly avatarID: string;
  readonly failureAction: ActivityFailureAction;
}

interface SetFailureActionOutput {
  readonly failureAction: ActivityFailureAction;
}

/**
 * Applies a tab's failure-action change and answers with the applied value. Every connection
 * hears the effective value through the broadcast — the caller's own tab included, since the
 * broadcast is the only echo it gets. The push to the server is single-flight per worker: a
 * change arriving while a push runs coalesces onto it, so an older push's acknowledgement can
 * never clear the dirty flag or cache a value already superseded. Delivery is best-effort — a
 * connectivity failure leaves the cache dirty for the next resync's reconcile to retry.
 */
export async function handleSetFailureActionMessage(
  context: WorkerContext,
  input: Readonly<SetFailureActionInput>,
): Promise<SetFailureActionOutput> {
  // Synchronous in-memory effects land first, before any await, so a slow persistence or push
  // never delays them.
  context.setFailureAction(input.failureAction);
  context.setFailureActionDirty(true);
  context.getSimulation().setFailureAction(input.failureAction);

  const statusMessage = {
    failureAction: input.failureAction,
    type: WorkerMessageType.FailureActionStatus,
  } satisfies WorkerMessage;

  context.broadcast(statusMessage);

  // The device-local cache records the change dirty as an offline outbox entry before the push.
  await writeFailureActionCache({
    avatarID: input.avatarID,
    dirty: true,
    failureAction: input.failureAction,
  });

  if (!context.isFailureActionPushInFlight()) {
    context.setFailureActionPushInFlight(true);

    try {
      await flushFailureAction(context, input.avatarID);
    } finally {
      context.setFailureActionPushInFlight(false);
    }
  }

  return { failureAction: input.failureAction };
}

async function flushFailureAction(context: WorkerContext, avatarID: string): Promise<void> {
  let pushed = context.getFailureAction();
  let confirmed = false;

  // A delivery failure ends the loop, leaving the value dirty for the next resync's reconcile to
  // retry.
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
