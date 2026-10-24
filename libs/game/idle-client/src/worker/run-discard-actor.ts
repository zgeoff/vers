import { match } from 'ts-pattern';
import { fromPromise } from 'xstate';
import { removeAvatarOfflineWork } from '../submission/remove-avatar-offline-work';
import { removeOfflineWork } from '../submission/remove-offline-work';
import { resetSimulation } from './reset-simulation';
import type { PendingFlowRequestOf, WorkerContext } from './types';

export const runDiscardActor = fromPromise<
  void,
  { readonly context: WorkerContext; readonly request: PendingFlowRequestOf<'discard'> }
>(async (args) => {
  await match(args.input.request.trigger)
    .with({ kind: 'sign-out' }, async (signOut) => {
      await removeAvatarOfflineWork(signOut.avatarIDs);

      resetSimulation(args.input.context);
    })
    .with({ kind: 'takeover' }, () => removeOfflineWork())
    .exhaustive();
});
