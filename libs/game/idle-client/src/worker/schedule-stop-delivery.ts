import type { Deferred } from './build-deferred';
import { submitStopIntent } from './submit-stop-intent';
import type { StopActivityInput, WorkerContext, WorkerLifecycleEvent } from './types';

type StopDeliveryDoneEvent = Extract<WorkerLifecycleEvent, { readonly type: 'STOP_DELIVERY_DONE' }>;

interface StopDeliverySender {
  readonly send: (event: StopDeliveryDoneEvent) => void;
}

export function scheduleStopDelivery(
  runtime: WorkerContext,
  self: StopDeliverySender,
  input: Readonly<StopActivityInput>,
  deferred: Deferred<void>,
): void {
  void (async () => {
    try {
      await runStopDelivery(runtime, input);

      deferred.resolve();
    } catch (error) {
      deferred.reject(error);
    } finally {
      self.send({ type: 'STOP_DELIVERY_DONE' });
    }
  })();
}

async function runStopDelivery(
  runtime: WorkerContext,
  input: Readonly<StopActivityInput>,
): Promise<void> {
  await submitStopIntent(runtime, { avatarID: input.avatarID, id: input.activityID });
}
