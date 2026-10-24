import { match } from 'ts-pattern';
import { fromPromise } from 'xstate';
import { removeAvatarOfflineWork } from '../submission/remove-avatar-offline-work';
import { removeOfflineWork } from '../submission/remove-offline-work';
import { resetSimulation } from './reset-simulation';
import type { PendingFlowRequestOf, WorkerContext } from './types';
import { updateWriterDisplacedStatus } from './update-writer-displaced-status';

export const runDiscardActor = fromPromise<
  void,
  { readonly context: WorkerContext; readonly request: PendingFlowRequestOf<'discard'> }
>(async (args) => {
  const context = args.input.context;

  await match(args.input.request.trigger)
    .with({ kind: 'sign-out' }, async (signOut) => {
      await removeAvatarOfflineWork(signOut.avatarIDs);

      resetSimulation(context);
    })
    .with({ kind: 'takeover' }, async () => {
      const displaced = context.getActivity();

      // halted before the outbox clears, so the run queues no checkpoint behind the discard
      if (displaced !== null) {
        resetSimulation(context);
        updateWriterDisplacedStatus(context, displaced.id);
      }

      await removeOfflineWork();
    })
    .exhaustive();
});
