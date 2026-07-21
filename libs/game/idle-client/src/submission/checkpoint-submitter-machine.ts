import type { ActorRefFromLogic } from 'xstate';
import { assign, setup, stopChild } from 'xstate';
import { buildMachineTypes } from './build-machine-types';
import type {
  CheckpointActivityInput,
  CheckpointActivitySettledEvent,
} from './checkpoint-activity-machine';
import { checkpointActivityMachine } from './checkpoint-activity-machine';

export type CheckpointActivityChildRef = ActorRefFromLogic<typeof checkpointActivityMachine>;

interface CheckpointSubmitterContext {
  readonly children: ReadonlyMap<string, CheckpointActivityChildRef>;
  readonly evictedActivityIDs: ReadonlySet<string>;
}

type CheckpointSubmitterEvent =
  | CheckpointActivitySettledEvent
  | ({ readonly type: 'REGISTER' } & CheckpointActivityInput)
  | { readonly activityID: string; readonly type: 'REMOVE_EVICTION' };

/**
 * Spawns one activity child per registered activity, keyed by activity id both as the machine's
 * own child id (so the machine can stop it by id) and in `context.children` (so the adapter can
 * address a specific child directly). Owns `evictedActivityIDs`: the eviction answer must survive
 * a child's eviction stop, since a stopped actor's own state is no longer queryable. Eviction
 * cleanup order — settle the child, then stop it and drop it from `context.children` in the same
 * transition — lets the adapter's own cleanup (write cursor, registration memo), reacting to that
 * same settlement, find the child already gone.
 */
export const checkpointSubmitterMachine = setup({
  actors: { checkpointActivityMachine },
  types: buildMachineTypes<{
    context: CheckpointSubmitterContext;
    events: CheckpointSubmitterEvent;
  }>(),
}).createMachine({
  context: { children: new Map(), evictedActivityIDs: new Set() },
  id: 'checkpointSubmitter',
  initial: 'running',
  states: {
    running: {
      on: {
        CHILD_SETTLED: {
          actions: [
            assign({
              children: (args) => {
                const next = new Map(args.context.children);

                next.delete(args.event.activityID);

                return next;
              },
              evictedActivityIDs: (args) => {
                if (!args.event.sessionEvicted) {
                  return args.context.evictedActivityIDs;
                }

                return new Set([...args.context.evictedActivityIDs, args.event.activityID]);
              },
            }),
            stopChild((args) => args.event.activityID),
          ],
        },
        REGISTER: {
          actions: assign({
            children: (args) =>
              new Map([
                ...args.context.children,
                [
                  args.event.activityID,
                  args.spawn('checkpointActivityMachine', {
                    id: args.event.activityID,
                    input: { ...args.event, parentRef: args.self },
                  }),
                ],
              ]),
            evictedActivityIDs: (args) =>
              buildEvictionsWithout(args.context.evictedActivityIDs, args.event.activityID),
          }),
        },
        REMOVE_EVICTION: {
          actions: assign({
            evictedActivityIDs: (args) =>
              buildEvictionsWithout(args.context.evictedActivityIDs, args.event.activityID),
          }),
        },
      },
    },
  },
});

function buildEvictionsWithout(
  evictedActivityIDs: ReadonlySet<string>,
  activityID: string,
): ReadonlySet<string> {
  if (!evictedActivityIDs.has(activityID)) {
    return evictedActivityIDs;
  }

  const next = new Set(evictedActivityIDs);

  next.delete(activityID);

  return next;
}
