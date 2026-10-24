import invariant from 'tiny-invariant';
import { assign, enqueueActions, setup } from 'xstate';
import { buildMachineTypes } from '../submission/build-machine-types';
import { checkpointSubmitterMachine } from '../submission/checkpoint-submitter-machine';
import { WorkerMessageType } from '../types';
import { applyDiscardSettlement } from './apply-discard-settlement';
import { applyEscapedRequest } from './apply-escaped-request';
import { applyResyncSettlement } from './apply-resync-settlement';
import { applyStopHalt } from './apply-stop-halt';
import { buildFlowSignals } from './build-flow-signals';
import { buildFreshStopScope } from './build-fresh-stop-scope';
import { buildPendingPop } from './build-pending-pop';
import { buildPrerequisiteResync } from './build-prerequisite-resync';
import { buildResyncRequest } from './build-resync-request';
import { buildResyncSettlePop } from './build-resync-settle-pop';
import { buildStartRequest } from './build-start-request';
import { hasLiveActivity } from './has-live-activity';
import { hasQueuedTakeoverDiscard } from './has-queued-takeover-discard';
import { isFlowActive } from './is-flow-active';
import { isIdleOrRunning } from './is-idle-or-running';
import { runContinuationActor } from './run-continuation-actor';
import { runDiscardActor } from './run-discard-actor';
import { runEvictionActor } from './run-eviction-actor';
import { runResyncActor } from './run-resync-actor';
import { runStartActor } from './run-start-actor';
import { scheduleReconnectRecovery } from './schedule-reconnect-recovery';
import { scheduleStopDelivery } from './schedule-stop-delivery';
import { shouldResyncBeforeStart } from './should-resync-before-start';
import type { WorkerLifecycleContext, WorkerLifecycleEvent, WorkerLifecycleInput } from './types';

export const workerLifecycleMachine = setup({
  actions: {
    // ordered: the old scope aborts, the fresh scope installs, the local halt runs against it,
    // and the durable delivery schedules concurrently — xstate runs declared actions in order
    runStopHalt: enqueueActions((args) => {
      const event = args.event;

      invariant(event.type === 'STOP_ACTIVITY', 'the stop halt runs only for a stop event');

      args.enqueue((enqueued) => {
        applyStopScopeAbort(enqueued.context);
      });

      args.enqueue.assign((enqueued) => buildFreshStopScope(enqueued.context));

      args.enqueue((enqueued) => {
        applyStopHalt(enqueued.context);
      });

      args.enqueue((enqueued) => {
        scheduleStopDelivery(enqueued.context.runtime, enqueued.self, event.input, event.deferred);
      });
    }),
  },
  actors: {
    checkpointSubmitterMachine,
    runContinuationActor,
    runDiscardActor,
    runEvictionActor,
    runResyncActor,
    runStartActor,
  },
  types: buildMachineTypes<{
    context: WorkerLifecycleContext;
    events: WorkerLifecycleEvent;
    input: WorkerLifecycleInput;
  }>(),
}).createMachine({
  context: (args) => {
    const stopController = new AbortController();

    return {
      cancelSignal: AbortSignal.any([stopController.signal, args.input.shutdownSignal]),
      currentRequest: null,
      failureActionSeeded: args.input.failureActionSeeded,
      pending: [],
      phase: 'idle',
      resyncTicket: null,
      runtime: args.input.runtime,
      shutdownSignal: args.input.shutdownSignal,
      startToken: null,
      stopController,

      // spawned through the actor system rather than invoked, so it survives every invoked
      // flow's own service: the submitter's own registration events (flush sequencing, backoff,
      // eviction marking) are unrelated to this machine's declared states
      submitterRef: args.spawn('checkpointSubmitterMachine'),
      writerDisplacedActivityID: null,
    };
  },
  id: 'workerLifecycle',
  initial: 'idle',
  on: {
    ADVANCE_STOP_SCOPE: {
      actions: [
        (args) => {
          applyStopScopeAbort(args.context);
        },
        assign((args) => buildFreshStopScope(args.context)),
      ],
    },
    CONTINUATION: [
      {
        actions: assign((args) => ({
          pending: [
            ...args.context.pending,
            {
              activity: args.event.activity,
              deferred: args.event.deferred,
              kind: 'continuation' as const,
              simulation: args.event.simulation,
            },
          ],
        })),
        guard: isFlowActive,
      },
      {
        actions: assign((args) => ({
          currentRequest: {
            activity: args.event.activity,
            deferred: args.event.deferred,
            kind: 'continuation' as const,
            simulation: args.event.simulation,
          },
        })),
        target: '.continuing',
      },
    ],
    DISCARD: [
      { guard: (args) => hasQueuedTakeoverDiscard(args.context, args.event.trigger) },
      {
        actions: assign((args) => ({
          pending: [
            ...args.context.pending,
            { kind: 'discard' as const, trigger: args.event.trigger },
          ],
        })),
        guard: isFlowActive,
      },
      {
        actions: assign((args) => ({
          currentRequest: { kind: 'discard' as const, trigger: args.event.trigger },
        })),
        target: '.discarding',
      },
    ],
    OFFLINE: {
      actions: (args) => {
        args.context.runtime.updateConnectivity(false);
      },
    },
    ONLINE: {
      actions: [
        (args) => {
          args.context.runtime.updateConnectivity(true);
        },
        (args) => {
          scheduleReconnectRecovery(args.context);
        },
      ],
    },
    RESYNC: [
      {
        actions: [
          assign((args) => {
            if (!args.event.claim) {
              return {};
            }

            return { resyncTicket: { pendingClaimAvatarID: args.event.avatarID } };
          }),
          (args) => {
            args.event.deferred.resolve();
          },
        ],
        guard: (args) => args.context.resyncTicket !== null,
      },
      {
        actions: assign((args) => ({
          pending: [
            ...args.context.pending,
            buildResyncRequest({
              context: args.context,
              avatarID: args.event.avatarID,
              claim: args.event.claim,
              deferred: args.event.deferred,
              carryOverDeferreds: [],
            }),
          ],
          resyncTicket: { pendingClaimAvatarID: null },
        })),
        guard: isFlowActive,
      },
      {
        actions: assign((args) => ({
          currentRequest: buildResyncRequest({
            context: args.context,
            avatarID: args.event.avatarID,
            claim: args.event.claim,
            deferred: args.event.deferred,
            carryOverDeferreds: [],
          }),
          resyncTicket: { pendingClaimAvatarID: null },
        })),
        target: '.resyncing',
      },
    ],
    SET_START_TOKEN: { actions: assign({ startToken: (args) => args.event.token }) },
    SET_WRITER_DISPLACED: {
      actions: assign({ writerDisplacedActivityID: (args) => args.event.activityID }),
    },
    START: [
      {
        actions: assign((args) => {
          const token = crypto.randomUUID();

          return {
            pending: [...args.context.pending, buildStartRequest(args.event, token)],
            startToken: token,
          };
        }),
        guard: isFlowActive,
      },
      {
        actions: assign((args) => {
          const token = crypto.randomUUID();

          return { currentRequest: buildStartRequest(args.event, token), startToken: token };
        }),
        target: '.dispatching',
      },
    ],
    STOP_ACTIVITY: [
      {
        actions: (args) => {
          args.event.deferred.resolve();
        },
        guard: (args) => {
          const liveID = args.context.runtime.getActivity()?.id;

          return liveID !== undefined && liveID !== args.event.input.activityID;
        },
      },
      {
        actions: 'runStopHalt',
        guard: isIdleOrRunning,
        target: '.stopping',
      },
      { actions: 'runStopHalt' },
    ],
    STOP_DELIVERY_DONE: {
      guard: (args) => args.context.phase === 'stopping',
      target: '.idle',
    },
    SUBMITTER_ACKED: {
      actions: (args) => {
        args.context.runtime.setLastAckAt(Date.now());
      },
    },
    SUBMITTER_CAPPED: {
      actions: (args) => {
        args.context.runtime.broadcast({
          halted: true,
          remainingMs: 0,
          type: WorkerMessageType.OfflineCapStatus,
        });
      },
    },
    SUBMITTER_EVICTED: [
      {
        actions: assign((args) => ({
          pending: [
            ...args.context.pending,
            { activityID: args.event.activityID, kind: 'eviction' as const },
          ],
        })),
        guard: isFlowActive,
      },
      {
        actions: assign((args) => ({
          currentRequest: { activityID: args.event.activityID, kind: 'eviction' as const },
        })),
        target: '.evicting',
      },
    ],
    SUBMITTER_HELD: {
      actions: (args) => {
        args.context.runtime.updateConnectivity(false);
      },
    },
    SUBMITTER_JOURNAL_FAILED: {
      actions: (args) => {
        args.context.runtime.stopTicking();
      },
    },
    SUBMITTER_SERVER_CONTACT: {
      actions: (args) => {
        if (args.context.runtime.getConnectivityOnline()) {
          return;
        }

        args.context.runtime.updateConnectivity(true);

        scheduleReconnectRecovery(args.context);
      },
    },
  },
  states: {
    continuing: {
      entry: assign({ phase: 'continuing' as const }),
      invoke: {
        input: (args) => {
          const request = args.context.currentRequest;

          invariant(request?.kind === 'continuation', 'expected a queued continuation request');

          return { context: args.context.runtime, request };
        },
        onDone: {
          actions: [
            (args) => {
              const request = args.context.currentRequest;

              invariant(request?.kind === 'continuation', 'expected a queued continuation request');

              request.deferred.resolve();
            },
            assign((args) => buildPendingPop(args.context)),
          ],
          target: '#workerLifecycle.dispatching',
        },
        onError: {
          actions: [
            (args) => {
              applyEscapedRequest(args.context, 'continuation', args.event.error);
            },
            assign((args) => buildPendingPop(args.context)),
          ],
          target: '#workerLifecycle.dispatching',
        },
        // oxlint-disable-next-line zgeoff/no-abbreviated-names -- xstate names an invoke's actor `src`
        src: 'runContinuationActor',
      },
    },

    // never observed between events: its always-transitions resolve within the settling flow's own
    // step, so a snapshot only ever shows the stable state the popped request (or its absence)
    // selects
    dispatching: {
      always: [
        // the resync is built here, as the start reaches the head of the queue, so its signals
        // follow the stop scope current at that moment and an earlier flow's changes to the live
        // run are already visible
        {
          actions: assign((args) => buildPrerequisiteResync(args.context)),
          guard: (args) => shouldResyncBeforeStart(args.context),
          target: 'resyncing',
        },
        {
          guard: (args) => args.context.currentRequest?.kind === 'start',
          target: 'starting',
        },
        {
          guard: (args) => args.context.currentRequest?.kind === 'resync',
          target: 'resyncing',
        },
        {
          guard: (args) => args.context.currentRequest?.kind === 'continuation',
          target: 'continuing',
        },
        {
          guard: (args) => args.context.currentRequest?.kind === 'eviction',
          target: 'evicting',
        },
        {
          guard: (args) => args.context.currentRequest?.kind === 'discard',
          target: 'discarding',
        },
        { guard: hasLiveActivity, target: 'running' },
        { target: 'idle' },
      ],
    },
    discarding: {
      entry: assign({ phase: 'discarding' as const }),
      invoke: {
        input: (args) => {
          const request = args.context.currentRequest;

          invariant(request?.kind === 'discard', 'expected a queued discard request');

          return { context: args.context.runtime, request };
        },
        onDone: {
          actions: [
            (args) => {
              applyDiscardSettlement(args.context, { kind: 'done' });
            },
            assign((args) => buildPendingPop(args.context)),
          ],
          target: '#workerLifecycle.dispatching',
        },
        onError: {
          actions: [
            (args) => {
              applyDiscardSettlement(args.context, { error: args.event.error, kind: 'failed' });
            },
            assign((args) => buildPendingPop(args.context)),
          ],
          target: '#workerLifecycle.dispatching',
        },
        // oxlint-disable-next-line zgeoff/no-abbreviated-names -- xstate names an invoke's actor `src`
        src: 'runDiscardActor',
      },
    },
    evicting: {
      entry: assign({ phase: 'evicting' as const }),
      invoke: {
        input: (args) => {
          const request = args.context.currentRequest;

          invariant(request?.kind === 'eviction', 'expected a queued eviction request');

          return { context: args.context.runtime, request };
        },

        // no deferred settles here — no caller awaits an eviction
        onDone: {
          actions: assign((args) => buildPendingPop(args.context)),
          target: '#workerLifecycle.dispatching',
        },
        onError: {
          actions: [
            (args) => {
              applyEscapedRequest(args.context, 'eviction', args.event.error);
            },
            assign((args) => buildPendingPop(args.context)),
          ],
          target: '#workerLifecycle.dispatching',
        },
        // oxlint-disable-next-line zgeoff/no-abbreviated-names -- xstate names an invoke's actor `src`
        src: 'runEvictionActor',
      },
    },
    idle: { entry: assign({ phase: 'idle' as const }) },
    resyncing: {
      entry: assign({ phase: 'resyncing' as const }),
      invoke: {
        input: (args) => {
          const request = args.context.currentRequest;

          invariant(request?.kind === 'resync', 'expected a queued resync request');

          return { context: args.context.runtime, request };
        },
        onDone: {
          actions: [
            (args) => {
              applyResyncSettlement(args.context);
            },
            assign((args) => buildResyncSettlePop(args.context)),
          ],
          target: '#workerLifecycle.dispatching',
        },

        // an escape drops any held claim rather than requeueing it — the coalescing window must
        // never survive a failure, or every later non-claiming resync would drop forever
        onError: {
          actions: [
            (args) => {
              applyEscapedRequest(args.context, 'resync', args.event.error);
            },
            assign((args) => ({ ...buildPendingPop(args.context), resyncTicket: null })),
          ],
          target: '#workerLifecycle.dispatching',
        },
        // oxlint-disable-next-line zgeoff/no-abbreviated-names -- xstate names an invoke's actor `src`
        src: 'runResyncActor',
      },
    },
    running: { entry: assign({ phase: 'running' as const }) },
    starting: {
      entry: assign({ phase: 'starting' as const }),
      invoke: {
        // signals are built here, at flow start, not at accept — a stop scope advanced while the
        // request waited its queue slot must not pre-abort the run it asked for
        input: (args) => {
          const request = args.context.currentRequest;

          invariant(request?.kind === 'start', 'expected a queued start request');

          return {
            context: args.context.runtime,
            request,
            signals: buildFlowSignals(args.context),
          };
        },
        onDone: {
          actions: [
            (args) => {
              const request = args.context.currentRequest;

              invariant(request?.kind === 'start', 'expected a queued start request');

              request.deferred.resolve(args.event.output);
            },
            assign((args) => buildPendingPop(args.context)),
          ],
          target: '#workerLifecycle.dispatching',
        },
        onError: {
          actions: [
            (args) => {
              applyEscapedRequest(args.context, 'start', args.event.error);
            },
            assign((args) => buildPendingPop(args.context)),
          ],
          target: '#workerLifecycle.dispatching',
        },
        // oxlint-disable-next-line zgeoff/no-abbreviated-names -- xstate names an invoke's actor `src`
        src: 'runStartActor',
      },
    },
    stopping: { entry: assign({ phase: 'stopping' as const }) },
  },
});

function applyStopScopeAbort(context: WorkerLifecycleContext): void {
  context.stopController.abort();
}
