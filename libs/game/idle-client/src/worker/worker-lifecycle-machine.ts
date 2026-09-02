import type { ActivityData } from '@vers/contract-activity';
import type { Simulation } from '@vers/idle-core';
import invariant from 'tiny-invariant';
import type { ActorRefFromLogic } from 'xstate';
import { assign, enqueueActions, fromPromise, setup } from 'xstate';
import { buildMachineTypes } from '../submission/build-machine-types';
import { checkpointSubmitterMachine } from '../submission/checkpoint-submitter-machine';
import { WorkerMessageType } from '../types';
import { applyEviction } from './apply-eviction';
import type { Deferred } from './build-deferred';
import { buildDeferred } from './build-deferred';
import { isAbortError } from './is-abort-error';
import type { WorkerFaultSite } from './report-worker-fault';
import { reportWorkerFault } from './report-worker-fault';
import { resetSimulation } from './reset-simulation';
import { runContinuation } from './run-continuation';
import { runReconnectRecovery } from './run-reconnect-recovery';
import { runResyncFlow } from './run-resync-flow';
import { runStartFlow } from './run-start-flow';
import { submitStopIntent } from './submit-stop-intent';
import type { FlowSignals, StartActivityInput, StopActivityInput, WorkerContext } from './types';
import type { StartStatus } from './worker-contract';

type PendingFlowRequest =
  | {
      readonly kind: 'start';
      readonly input: Readonly<StartActivityInput>;
      readonly token: string;
      readonly deferred: Deferred<StartStatus>;
    }
  | {
      readonly kind: 'resync';
      readonly avatarID: string;
      readonly claim: boolean;
      readonly signals: Readonly<FlowSignals>;
      readonly deferred: Deferred<void>;
      readonly carryOverDeferreds: ReadonlyArray<Deferred<void>>;
    }
  | {
      readonly kind: 'continuation';
      readonly simulation: Simulation;
      readonly activity: Readonly<ActivityData>;
      readonly deferred: Deferred<void>;
    }
  | { readonly kind: 'eviction'; readonly activityID: string };

type PendingFlowRequestOf<K extends PendingFlowRequest['kind']> = Extract<
  PendingFlowRequest,
  { readonly kind: K }
>;

type Phase = 'continuing' | 'evicting' | 'idle' | 'resyncing' | 'running' | 'starting' | 'stopping';

interface ResyncTicket {
  readonly pendingClaimAvatarID: string | null;
}

interface WorkerLifecycleContext {
  readonly cancelSignal: AbortSignal;
  readonly currentRequest: PendingFlowRequest | null;
  readonly failureActionSeeded: Promise<void>;
  readonly pending: ReadonlyArray<PendingFlowRequest>;
  readonly phase: Phase;
  readonly resyncTicket: ResyncTicket | null;
  readonly runtime: WorkerContext;
  readonly shutdownSignal: AbortSignal;
  readonly startToken: string | null;
  readonly stopController: AbortController;

  // written inline rather than behind a local alias: the readonly-parameters lint exempts the
  // xstate ref by its own name, and an alias would hide it from that match
  readonly submitterRef: ActorRefFromLogic<typeof checkpointSubmitterMachine>;
  readonly writerDisplacedActivityID: string | null;
}

interface WorkerLifecycleInput {
  readonly failureActionSeeded: Promise<void>;
  readonly runtime: WorkerContext;
  readonly shutdownSignal: AbortSignal;
}

type WorkerLifecycleEvent =
  | { readonly type: 'ADVANCE_STOP_SCOPE' }
  | {
      readonly type: 'CONTINUATION';
      readonly simulation: Simulation;
      readonly activity: Readonly<ActivityData>;
      readonly deferred: Deferred<void>;
    }
  | { readonly type: 'OFFLINE' }
  | { readonly type: 'ONLINE' }
  | {
      readonly type: 'RESYNC';
      readonly avatarID: string;
      readonly claim: boolean;
      readonly deferred: Deferred<void>;
    }
  | { readonly type: 'SET_START_TOKEN'; readonly token: string }
  | { readonly type: 'SET_WRITER_DISPLACED'; readonly activityID: string | null }
  | {
      readonly type: 'START';
      readonly input: Readonly<StartActivityInput>;
      readonly deferred: Deferred<StartStatus>;
    }
  | {
      readonly type: 'STOP_ACTIVITY';
      readonly input: Readonly<StopActivityInput>;
      readonly deferred: Deferred<void>;
    }
  | { readonly type: 'STOP_DELIVERY_DONE' }
  | { readonly type: 'SUBMITTER_ACKED' }
  | { readonly type: 'SUBMITTER_CAPPED' }
  | { readonly type: 'SUBMITTER_EVICTED'; readonly activityID: string }
  | { readonly type: 'SUBMITTER_HELD' }
  | { readonly type: 'SUBMITTER_SERVER_CONTACT' };

type StopDeliveryDoneEvent = Extract<WorkerLifecycleEvent, { readonly type: 'STOP_DELIVERY_DONE' }>;

interface StopDeliverySender {
  readonly send: (event: StopDeliveryDoneEvent) => void;
}

type ContextArg = Readonly<{ context: WorkerLifecycleContext }>;

const runStartActor = fromPromise<
  StartStatus,
  {
    readonly context: WorkerContext;
    readonly request: PendingFlowRequestOf<'start'>;
    readonly signals: Readonly<FlowSignals>;
  }
>(async (args) => {
  try {
    return await runStartFlow(
      args.input.context,
      args.input.request.input,
      args.input.request.token,
      args.input.signals,
    );
  } catch (error) {
    if (!isAbortError(error, args.input.signals.cancel)) {
      reportWorkerFault('start', error);
    }

    return { kind: 'failed' };
  }
});

const runResyncActor = fromPromise<
  void,
  { readonly context: WorkerContext; readonly request: PendingFlowRequestOf<'resync'> }
>((args) =>
  runFlowBody('resync', () =>
    runResyncFlow(
      args.input.context,
      args.input.request.avatarID,
      args.input.request.claim,
      args.input.request.signals,
    ),
  ),
);

const runContinuationActor = fromPromise<
  void,
  { readonly context: WorkerContext; readonly request: PendingFlowRequestOf<'continuation'> }
>((args) =>
  runFlowBody('continuation', () =>
    runContinuation(args.input.context, args.input.request.simulation, args.input.request.activity),
  ),
);

const runEvictionActor = fromPromise<
  void,
  { readonly context: WorkerContext; readonly request: PendingFlowRequestOf<'eviction'> }
>((args) =>
  runFlowBody('eviction', async () => {
    // SUBMITTER_EVICTED can land synchronously inside the submitter's own flush callback, ahead
    // of the child settlement that records the eviction on the submitter — waiting a macrotask
    // lets every microtask that settlement rides land first, so the guard below reads it
    await waitForMacrotask();

    applyEviction(args.input.context, args.input.request.activityID);
  }),
);

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

  // the actor can stop while requests are queued or running — settling every outstanding deferred
  // here keeps entry points awaiting them from hanging past teardown
  exit: (args) => {
    applyTeardownSettlement(args.context);
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
            buildResyncRequest(
              args.context,
              args.event.avatarID,
              args.event.claim,
              args.event.deferred,
              [],
            ),
          ],
          resyncTicket: { pendingClaimAvatarID: null },
        })),
        guard: isFlowActive,
      },
      {
        actions: assign((args) => ({
          currentRequest: buildResyncRequest(
            args.context,
            args.event.avatarID,
            args.event.claim,
            args.event.deferred,
            [],
          ),
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
            pending: [
              ...args.context.pending,
              {
                deferred: args.event.deferred,
                input: args.event.input,
                kind: 'start' as const,
                token,
              },
            ],
            startToken: token,
          };
        }),
        guard: isFlowActive,
      },
      {
        actions: assign((args) => {
          const token = crypto.randomUUID();

          return {
            currentRequest: {
              deferred: args.event.deferred,
              input: args.event.input,
              kind: 'start' as const,
              token,
            },
            startToken: token,
          };
        }),
        target: '.starting',
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
        src: 'runContinuationActor',
      },
    },

    // never observed between events: its always-transitions resolve within the settling flow's own
    // step, so a snapshot only ever shows the stable state the popped request (or its absence)
    // selects
    dispatching: {
      always: [
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
        { guard: hasLiveActivity, target: 'running' },
        { target: 'idle' },
      ],
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
        src: 'runStartActor',
      },
    },
    stopping: { entry: assign({ phase: 'stopping' as const }) },
  },
});

async function runFlowBody(site: WorkerFaultSite, body: () => Promise<void>): Promise<void> {
  try {
    await body();
  } catch (error) {
    reportWorkerFault(site, error);
  }
}

function buildFlowSignals(context: WorkerLifecycleContext): FlowSignals {
  return { cancel: context.cancelSignal, stop: context.stopController.signal };
}

function buildResyncRequest(
  context: WorkerLifecycleContext,
  avatarID: string,
  claim: boolean,
  deferred: Deferred<void>,
  carryOverDeferreds: ReadonlyArray<Deferred<void>>,
): PendingFlowRequestOf<'resync'> {
  return {
    avatarID,
    carryOverDeferreds,
    claim,
    deferred,
    kind: 'resync',
    signals: buildFlowSignals(context),
  };
}

function isFlowActive(args: ContextArg): boolean {
  return (
    args.context.phase === 'starting' ||
    args.context.phase === 'resyncing' ||
    args.context.phase === 'continuing' ||
    args.context.phase === 'evicting'
  );
}

function isIdleOrRunning(args: ContextArg): boolean {
  return args.context.phase === 'idle' || args.context.phase === 'running';
}

function hasLiveActivity(args: ContextArg): boolean {
  return args.context.runtime.getActivity() !== null;
}

function applyEscapedRequest(
  context: WorkerLifecycleContext,
  site: WorkerFaultSite,
  error: unknown,
): void {
  reportWorkerFault(site, error);

  const request = context.currentRequest;

  if (request === null || request.kind === 'eviction') {
    return;
  }

  if (request.kind === 'start') {
    request.deferred.resolve({ kind: 'failed' });

    return;
  }

  request.deferred.resolve();

  if (request.kind === 'resync') {
    for (const carryOver of request.carryOverDeferreds) {
      carryOver.resolve();
    }
  }
}

function buildPendingPop(
  context: WorkerLifecycleContext,
): Pick<WorkerLifecycleContext, 'currentRequest' | 'pending'> {
  return { currentRequest: context.pending[0] ?? null, pending: context.pending.slice(1) };
}

function findHeldResyncClaim(
  context: WorkerLifecycleContext,
): { readonly avatarID: string; readonly current: PendingFlowRequestOf<'resync'> } | null {
  const ticket = context.resyncTicket;
  const current = context.currentRequest;

  if (
    ticket === null ||
    ticket.pendingClaimAvatarID === null ||
    current === null ||
    current.kind !== 'resync'
  ) {
    return null;
  }

  return { avatarID: ticket.pendingClaimAvatarID, current };
}

function foldHeldResyncClaim(context: WorkerLifecycleContext): ReadonlyArray<PendingFlowRequest> {
  const heldClaim = findHeldResyncClaim(context);

  if (heldClaim === null) {
    return context.pending;
  }

  return [
    ...context.pending,
    buildResyncRequest(context, heldClaim.avatarID, true, buildDeferred<void>(), [
      ...heldClaim.current.carryOverDeferreds,
      heldClaim.current.deferred,
    ]),
  ];
}

function applyResyncSettlement(context: WorkerLifecycleContext): void {
  if (findHeldResyncClaim(context) !== null) {
    return;
  }

  const current = context.currentRequest;

  invariant(current?.kind === 'resync', 'expected a queued resync request');

  current.deferred.resolve();

  for (const carryOver of current.carryOverDeferreds) {
    carryOver.resolve();
  }
}

function buildResyncSettlePop(
  context: WorkerLifecycleContext,
): Pick<WorkerLifecycleContext, 'currentRequest' | 'pending' | 'resyncTicket'> {
  const heldClaim = findHeldResyncClaim(context);
  const pending = foldHeldResyncClaim(context);

  return {
    currentRequest: pending[0] ?? null,
    pending: pending.slice(1),
    resyncTicket: heldClaim === null ? null : { pendingClaimAvatarID: null },
  };
}

async function runStopDelivery(
  runtime: WorkerContext,
  input: Readonly<StopActivityInput>,
): Promise<void> {
  await submitStopIntent(runtime, { avatarID: input.avatarID, id: input.activityID });
}

function scheduleStopDelivery(
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

function scheduleReconnectRecovery(context: WorkerLifecycleContext): void {
  void (async () => {
    try {
      await context.failureActionSeeded;
      await runReconnectRecovery(context.runtime);
    } catch (error) {
      reportWorkerFault('reconnect', error);
    }
  })();
}

function applyStopScopeAbort(context: WorkerLifecycleContext): void {
  context.stopController.abort();
}

function buildFreshStopScope(
  context: WorkerLifecycleContext,
): Pick<WorkerLifecycleContext, 'cancelSignal' | 'stopController'> {
  const stopController = new AbortController();

  return {
    cancelSignal: AbortSignal.any([stopController.signal, context.shutdownSignal]),
    stopController,
  };
}

function applyTeardownSettlement(context: WorkerLifecycleContext): void {
  const requests = [context.currentRequest, ...context.pending];

  for (const request of requests) {
    if (request === null || request.kind === 'eviction') {
      continue;
    }

    if (request.kind === 'start') {
      request.deferred.resolve({ kind: 'failed' });
      continue;
    }

    request.deferred.resolve();

    if (request.kind === 'resync') {
      for (const carryOver of request.carryOverDeferreds) {
        carryOver.resolve();
      }
    }
  }
}

function applyStopHalt(context: WorkerLifecycleContext): void {
  context.runtime.getSimulation().stopActivity();

  resetSimulation(context.runtime);

  context.runtime.resetRewardSlotLedger();

  context.runtime.broadcast({
    state: { failureAction: context.runtime.getFailureAction() },
    type: WorkerMessageType.SimulationUpdate,
  });
}

function waitForMacrotask(): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, 0);
  });
}
