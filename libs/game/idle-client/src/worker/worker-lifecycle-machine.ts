import type { ActivityData } from '@vers/contract-activity';
import type { Simulation } from '@vers/idle-core';
import type { ActorRefFromLogic } from 'xstate';
import { assign, createActor, fromPromise, setup } from 'xstate';
import { buildMachineTypes } from '../submission/build-machine-types';
import { checkpointSubmitterMachine } from '../submission/checkpoint-submitter-machine';
import { removePendingStartIntent } from '../submission/remove-pending-start-intent';
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

/**
 * A flow request accepted into the actor's queue: `signals` are captured the instant the request
 * is accepted, not when its turn to run arrives, so a stop or shutdown raised while it waits still
 * cancels its installs and in-flight reads once it does run. A resync's `carryOverDeferreds`
 * accumulates the deferred of every earlier caller a chain of held claims displaced — each settles
 * once the requeued claim that superseded it finally does. `inline` exists only for tests that
 * need to occupy the queue with an arbitrary body, the way a real flow does.
 */
export type PendingFlowRequest =
  | {
      readonly kind: 'start';
      readonly input: Readonly<StartActivityInput>;
      readonly token: string;
      readonly signals: Readonly<FlowSignals>;
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
      readonly signals: Readonly<FlowSignals>;
      readonly deferred: Deferred<void>;
    }
  | { readonly kind: 'eviction'; readonly activityID: string }
  | {
      readonly kind: 'inline';
      readonly site: WorkerFaultSite;
      readonly run: () => Promise<void>;
      readonly deferred: Deferred<void>;
    };

type PendingFlowRequestOf<K extends PendingFlowRequest['kind']> = Extract<
  PendingFlowRequest,
  { readonly kind: K }
>;

type Phase =
  | 'continuing'
  | 'evicting'
  | 'idle'
  | 'inline'
  | 'resyncing'
  | 'running'
  | 'starting'
  | 'stopping';

interface ResyncTicket {
  readonly pendingClaimAvatarID: string | null;
}

type CheckpointSubmitterChildRef = ActorRefFromLogic<typeof checkpointSubmitterMachine>;

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
  readonly submitterRef: CheckpointSubmitterChildRef;
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
  | {
      readonly type: 'RUN_INLINE_TURN';
      readonly site: WorkerFaultSite;
      readonly run: () => Promise<void>;
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

/**
 * Narrows the currently claimed request to the kind its state's own invoked service expects — the
 * accept-or-enqueue transitions only ever route a request into the state matching its own kind, so
 * a mismatch here can only mean that invariant broke.
 */
function getExpectedRequest<K extends PendingFlowRequest['kind']>(
  request: PendingFlowRequest | null,
  kind: K,
): PendingFlowRequestOf<K> {
  if (request === null || request.kind !== kind) {
    throw new Error(`expected a queued ${kind} request`);
  }

  // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- narrowing a generic type parameter's own literal value against a runtime check is a TS limitation control flow analysis cannot bridge; the check just above is what makes this safe
  return request as PendingFlowRequestOf<K>;
}

async function runFlowBody(site: WorkerFaultSite, body: () => Promise<void>): Promise<void> {
  try {
    await body();
  } catch (error) {
    reportWorkerFault(site, error);
  }
}

// oxlint-disable-next-line typescript/prefer-readonly-parameter-types -- WorkerLifecycleContext embeds a live xstate ActorRef and AbortController/AbortSignal handles with no further readonly form
function buildFlowSignals(context: WorkerLifecycleContext): FlowSignals {
  return { cancel: context.cancelSignal, stop: context.stopController.signal };
}

function buildResyncRequest(
  // oxlint-disable-next-line typescript/prefer-readonly-parameter-types -- WorkerLifecycleContext embeds a live xstate ActorRef and AbortController/AbortSignal handles with no further readonly form
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

// oxlint-disable-next-line typescript/prefer-readonly-parameter-types -- WorkerLifecycleContext embeds a live xstate ActorRef and AbortController/AbortSignal handles with no further readonly form
function isFlowActive(args: ContextArg): boolean {
  return (
    args.context.phase === 'starting' ||
    args.context.phase === 'resyncing' ||
    args.context.phase === 'continuing' ||
    args.context.phase === 'evicting' ||
    args.context.phase === 'inline'
  );
}

// oxlint-disable-next-line typescript/prefer-readonly-parameter-types -- WorkerLifecycleContext embeds a live xstate ActorRef and AbortController/AbortSignal handles with no further readonly form
function isIdleOrRunning(args: ContextArg): boolean {
  return args.context.phase === 'idle' || args.context.phase === 'running';
}

// oxlint-disable-next-line typescript/prefer-readonly-parameter-types -- WorkerLifecycleContext embeds a live xstate ActorRef and AbortController/AbortSignal handles with no further readonly form
function hasLiveActivity(args: ContextArg): boolean {
  return args.context.runtime.getActivity() !== null;
}

function findNextRequestKind(
  // oxlint-disable-next-line typescript/prefer-readonly-parameter-types -- WorkerLifecycleContext embeds a live xstate ActorRef and AbortController/AbortSignal handles with no further readonly form
  context: WorkerLifecycleContext,
): PendingFlowRequest['kind'] | undefined {
  return context.pending[0]?.kind;
}

/**
 * Resolves the request whose invoked service just settled — the started status for a start, void
 * for a resync or continuation (plus every deferred a chain of held claims displaced), nothing for
 * an eviction, which no caller awaits.
 */
// oxlint-disable-next-line typescript/prefer-readonly-parameter-types -- WorkerLifecycleContext embeds a live xstate ActorRef and AbortController/AbortSignal handles with no further readonly form
function resolveSettledRequest(context: WorkerLifecycleContext, output: unknown): void {
  const request = context.currentRequest;

  if (request === null || request.kind === 'eviction') {
    return;
  }

  if (request.kind === 'start') {
    // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- the 'starting' state's own invoked service is the only caller of this branch, and it always produces a StartStatus
    request.deferred.resolve(output as StartStatus);

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
  // oxlint-disable-next-line typescript/prefer-readonly-parameter-types -- WorkerLifecycleContext embeds a live xstate ActorRef and AbortController/AbortSignal handles with no further readonly form
  context: WorkerLifecycleContext,
): Pick<WorkerLifecycleContext, 'currentRequest' | 'pending'> {
  return { currentRequest: context.pending[0] ?? null, pending: context.pending.slice(1) };
}

async function runStopDelivery(
  runtime: WorkerContext,
  input: Readonly<StopActivityInput>,
): Promise<void> {
  await removePendingStartIntent();
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
    } catch (error) {
      reportWorkerFault('stop', error);
    } finally {
      deferred.resolve();
      self.send({ type: 'STOP_DELIVERY_DONE' });
    }
  })();
}

function scheduleReconnectRecovery(
  // oxlint-disable-next-line typescript/prefer-readonly-parameter-types -- WorkerLifecycleContext embeds a live xstate ActorRef and AbortController/AbortSignal handles with no further readonly form
  context: WorkerLifecycleContext,
  avatarID?: string,
  claim = false,
): void {
  void (async () => {
    try {
      await context.failureActionSeeded;
      await runReconnectRecovery(context.runtime, avatarID, claim);
    } catch (error) {
      reportWorkerFault('reconnect', error);
    }
  })();
}

/**
 * Rotates the stop scope: aborts the current controller and installs a fresh one, so a flow
 * currently reading the old signal observes the abort while a flow accepted afterward captures the
 * new scope instead.
 */
function buildStopScopeAdvance(
  // oxlint-disable-next-line typescript/prefer-readonly-parameter-types -- WorkerLifecycleContext embeds a live xstate ActorRef and AbortController/AbortSignal handles with no further readonly form
  context: WorkerLifecycleContext,
): Pick<WorkerLifecycleContext, 'cancelSignal' | 'stopController'> {
  context.stopController.abort();

  const stopController = new AbortController();

  return {
    cancelSignal: AbortSignal.any([stopController.signal, context.shutdownSignal]),
    stopController,
  };
}

// oxlint-disable-next-line typescript/prefer-readonly-parameter-types -- WorkerLifecycleContext embeds a live xstate ActorRef and AbortController/AbortSignal handles with no further readonly form
function applyStopHalt(context: WorkerLifecycleContext): void {
  context.runtime.getSimulation().stopActivity();

  resetSimulation(context.runtime);

  context.runtime.resetRewardSlotLedger();

  context.runtime.broadcast({
    state: { failureAction: context.runtime.getFailureAction() },
    type: WorkerMessageType.SimulationUpdate,
  });
}

const runStartActor = fromPromise<
  StartStatus,
  { readonly context: WorkerContext; readonly request: PendingFlowRequestOf<'start'> }
>(async (args) => {
  try {
    return await runStartFlow(
      args.input.context,
      args.input.request.input,
      args.input.request.token,
      args.input.request.signals,
    );
  } catch (error) {
    if (!isAbortError(error, args.input.request.signals.cancel)) {
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
  runFlowBody('eviction', () => {
    applyEviction(args.input.context, args.input.request.activityID);

    return Promise.resolve();
  }),
);

const runInlineActor = fromPromise<void, { readonly request: PendingFlowRequestOf<'inline'> }>(
  (args) => runFlowBody(args.input.request.site, args.input.request.run),
);

/**
 * The worker's lifecycle owner: a start, a resync, a continuation, and an eviction settlement each
 * run as one flow at a time through `context.pending`, a FIFO queue of requests captured at the
 * instant they're accepted — never at the instant their turn to run arrives, so a stop or shutdown
 * raised while a request waits its slot still cancels the installs and in-flight reads its eventual
 * run performs. A flow's own body never rejects; an escaping error reports as a fault under the
 * request's site and the queue still advances. Only a public entry point sends an event — an inner
 * sub-flow one flow's own body needs (a continuation's conflict recovery, a blocked start-intent
 * retry) runs directly, within that flow's own active turn, since queueing it behind itself would
 * deadlock.
 *
 * A resync additionally coalesces: a non-claiming request arriving while `resyncTicket` is set —
 * covering both an active run and one still waiting its queue slot — is dropped, since the run
 * already resyncs against the freshest server state a retry could see. A claiming request in that
 * window is held one deep instead, latest avatar winning, and its own caller resolves immediately;
 * once the in-flight resync settles, the held claim requeues ahead of anything else queued, with a
 * fresh ticket and fresh signals, and the original caller's own promise settles only once that
 * requeued run does too.
 *
 * A stop is handled in every state: a live activity naming a different id is a no-op, otherwise the
 * local halt (advancing the stop scope, stopping and resetting the simulation, broadcasting the
 * cleared snapshot) runs synchronously in the event's own step, and the durable delivery runs
 * concurrently with whatever flow is active rather than queueing behind it — an active flow's own
 * invoked service is never torn down by a stop landing mid-flow, since it already abandons its own
 * install through the stop signal it captured at entry.
 */
export const workerLifecycleMachine = setup({
  actors: {
    runContinuationActor,
    runEvictionActor,
    runInlineActor,
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

      // not spawned through the actor system: the submitter's own registration events (flush
      // sequencing, backoff, eviction marking) are unrelated to this machine's own state, and a
      // plain child actor avoids constraining every other invoked service to its narrower type
      submitterRef: createActor(checkpointSubmitterMachine).start(),
      writerDisplacedActivityID: null,
    };
  },
  id: 'workerLifecycle',
  initial: 'idle',
  on: {
    ADVANCE_STOP_SCOPE: { actions: assign((args) => buildStopScopeAdvance(args.context)) },
    CONTINUATION: [
      {
        actions: assign((args) => ({
          pending: [
            ...args.context.pending,
            {
              activity: args.event.activity,
              deferred: args.event.deferred,
              kind: 'continuation' as const,
              signals: buildFlowSignals(args.context),
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
            signals: buildFlowSignals(args.context),
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
    RUN_INLINE_TURN: [
      {
        actions: assign((args) => ({
          pending: [
            ...args.context.pending,
            {
              deferred: args.event.deferred,
              kind: 'inline' as const,
              run: args.event.run,
              site: args.event.site,
            },
          ],
        })),
        guard: isFlowActive,
      },
      {
        actions: assign((args) => ({
          currentRequest: {
            deferred: args.event.deferred,
            kind: 'inline' as const,
            run: args.event.run,
            site: args.event.site,
          },
        })),
        target: '.inline',
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
                signals: buildFlowSignals(args.context),
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
              signals: buildFlowSignals(args.context),
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
        actions: [
          assign((args) => buildStopScopeAdvance(args.context)),
          (args) => {
            applyStopHalt(args.context);
          },
          (args) => {
            scheduleStopDelivery(
              args.context.runtime,
              args.self,
              args.event.input,
              args.event.deferred,
            );
          },
        ],
        guard: isIdleOrRunning,
        target: '.stopping',
      },
      {
        actions: [
          assign((args) => buildStopScopeAdvance(args.context)),
          (args) => {
            applyStopHalt(args.context);
          },
          (args) => {
            scheduleStopDelivery(
              args.context.runtime,
              args.self,
              args.event.input,
              args.event.deferred,
            );
          },
        ],
      },
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
        input: (args) => ({
          context: args.context.runtime,
          request: getExpectedRequest(args.context.currentRequest, 'continuation'),
        }),
        onDone: [
          {
            actions: assign((args) => {
              resolveSettledRequest(args.context, args.event.output);

              return { ...buildPendingPop(args.context) };
            }),
            guard: (args) => findNextRequestKind(args.context) === 'start',
            target: '#workerLifecycle.starting',
          },
          {
            actions: assign((args) => {
              resolveSettledRequest(args.context, args.event.output);

              return { ...buildPendingPop(args.context) };
            }),
            guard: (args) => findNextRequestKind(args.context) === 'resync',
            target: '#workerLifecycle.resyncing',
          },
          {
            actions: assign((args) => {
              resolveSettledRequest(args.context, args.event.output);

              return { ...buildPendingPop(args.context) };
            }),
            guard: (args) => findNextRequestKind(args.context) === 'continuation',
            reenter: true,
            target: '#workerLifecycle.continuing',
          },
          {
            actions: assign((args) => {
              resolveSettledRequest(args.context, args.event.output);

              return { ...buildPendingPop(args.context) };
            }),
            guard: (args) => findNextRequestKind(args.context) === 'eviction',
            target: '#workerLifecycle.evicting',
          },
          {
            actions: assign((args) => {
              resolveSettledRequest(args.context, args.event.output);

              return { ...buildPendingPop(args.context) };
            }),
            guard: (args) => findNextRequestKind(args.context) === 'inline',
            target: '#workerLifecycle.inline',
          },
          {
            actions: assign((args) => {
              resolveSettledRequest(args.context, args.event.output);

              return { ...buildPendingPop(args.context) };
            }),
            guard: hasLiveActivity,
            target: '#workerLifecycle.running',
          },
          {
            actions: assign((args) => {
              resolveSettledRequest(args.context, args.event.output);

              return { ...buildPendingPop(args.context) };
            }),
            target: '#workerLifecycle.idle',
          },
        ],
        src: 'runContinuationActor',
      },
    },
    evicting: {
      entry: assign({ phase: 'evicting' as const }),
      invoke: {
        input: (args) => ({
          context: args.context.runtime,
          request: getExpectedRequest(args.context.currentRequest, 'eviction'),
        }),
        onDone: [
          {
            actions: assign((args) => {
              resolveSettledRequest(args.context, args.event.output);

              return { ...buildPendingPop(args.context) };
            }),
            guard: (args) => findNextRequestKind(args.context) === 'start',
            target: '#workerLifecycle.starting',
          },
          {
            actions: assign((args) => {
              resolveSettledRequest(args.context, args.event.output);

              return { ...buildPendingPop(args.context) };
            }),
            guard: (args) => findNextRequestKind(args.context) === 'resync',
            target: '#workerLifecycle.resyncing',
          },
          {
            actions: assign((args) => {
              resolveSettledRequest(args.context, args.event.output);

              return { ...buildPendingPop(args.context) };
            }),
            guard: (args) => findNextRequestKind(args.context) === 'continuation',
            target: '#workerLifecycle.continuing',
          },
          {
            actions: assign((args) => {
              resolveSettledRequest(args.context, args.event.output);

              return { ...buildPendingPop(args.context) };
            }),
            guard: (args) => findNextRequestKind(args.context) === 'eviction',
            reenter: true,
            target: '#workerLifecycle.evicting',
          },
          {
            actions: assign((args) => {
              resolveSettledRequest(args.context, args.event.output);

              return { ...buildPendingPop(args.context) };
            }),
            guard: (args) => findNextRequestKind(args.context) === 'inline',
            target: '#workerLifecycle.inline',
          },
          {
            actions: assign((args) => {
              resolveSettledRequest(args.context, args.event.output);

              return { ...buildPendingPop(args.context) };
            }),
            guard: hasLiveActivity,
            target: '#workerLifecycle.running',
          },
          {
            actions: assign((args) => {
              resolveSettledRequest(args.context, args.event.output);

              return { ...buildPendingPop(args.context) };
            }),
            target: '#workerLifecycle.idle',
          },
        ],
        src: 'runEvictionActor',
      },
    },
    idle: { entry: assign({ phase: 'idle' as const }) },
    inline: {
      entry: assign({ phase: 'inline' as const }),
      invoke: {
        input: (args) => ({ request: getExpectedRequest(args.context.currentRequest, 'inline') }),
        onDone: [
          {
            actions: assign((args) => {
              resolveSettledRequest(args.context, args.event.output);

              return { ...buildPendingPop(args.context) };
            }),
            guard: (args) => findNextRequestKind(args.context) === 'start',
            target: '#workerLifecycle.starting',
          },
          {
            actions: assign((args) => {
              resolveSettledRequest(args.context, args.event.output);

              return { ...buildPendingPop(args.context) };
            }),
            guard: (args) => findNextRequestKind(args.context) === 'resync',
            target: '#workerLifecycle.resyncing',
          },
          {
            actions: assign((args) => {
              resolveSettledRequest(args.context, args.event.output);

              return { ...buildPendingPop(args.context) };
            }),
            guard: (args) => findNextRequestKind(args.context) === 'continuation',
            target: '#workerLifecycle.continuing',
          },
          {
            actions: assign((args) => {
              resolveSettledRequest(args.context, args.event.output);

              return { ...buildPendingPop(args.context) };
            }),
            guard: (args) => findNextRequestKind(args.context) === 'eviction',
            target: '#workerLifecycle.evicting',
          },
          {
            actions: assign((args) => {
              resolveSettledRequest(args.context, args.event.output);

              return { ...buildPendingPop(args.context) };
            }),
            guard: (args) => findNextRequestKind(args.context) === 'inline',
            reenter: true,
            target: '#workerLifecycle.inline',
          },
          {
            actions: assign((args) => {
              resolveSettledRequest(args.context, args.event.output);

              return { ...buildPendingPop(args.context) };
            }),
            guard: hasLiveActivity,
            target: '#workerLifecycle.running',
          },
          {
            actions: assign((args) => {
              resolveSettledRequest(args.context, args.event.output);

              return { ...buildPendingPop(args.context) };
            }),
            target: '#workerLifecycle.idle',
          },
        ],
        src: 'runInlineActor',
      },
    },
    resyncing: {
      entry: assign({ phase: 'resyncing' as const }),
      invoke: {
        input: (args) => ({
          context: args.context.runtime,
          request: getExpectedRequest(args.context.currentRequest, 'resync'),
        }),
        onDone: [
          {
            actions: assign((args) => {
              const ticket = args.context.resyncTicket;
              const current = args.context.currentRequest;

              if (
                ticket === null ||
                ticket.pendingClaimAvatarID === null ||
                current === null ||
                current.kind !== 'resync'
              ) {
                return {};
              }

              return {
                currentRequest: buildResyncRequest(
                  args.context,
                  ticket.pendingClaimAvatarID,
                  true,
                  buildDeferred<void>(),
                  [...current.carryOverDeferreds, current.deferred],
                ),
                resyncTicket: { pendingClaimAvatarID: null },
              };
            }),
            // oxlint-disable-next-line typescript/prefer-readonly-parameter-types -- WorkerLifecycleContext embeds a live xstate ActorRef and AbortController/AbortSignal handles with no further readonly form
            guard: (args: ContextArg) =>
              args.context.resyncTicket !== null &&
              args.context.resyncTicket.pendingClaimAvatarID !== null,
            reenter: true,
            target: '#workerLifecycle.resyncing',
          },
          {
            actions: assign((args) => {
              resolveSettledRequest(args.context, args.event.output);

              return { resyncTicket: null, ...buildPendingPop(args.context) };
            }),
            guard: (args) => findNextRequestKind(args.context) === 'start',
            target: '#workerLifecycle.starting',
          },
          {
            actions: assign((args) => {
              resolveSettledRequest(args.context, args.event.output);

              return { resyncTicket: null, ...buildPendingPop(args.context) };
            }),
            guard: (args) => findNextRequestKind(args.context) === 'resync',
            reenter: true,
            target: '#workerLifecycle.resyncing',
          },
          {
            actions: assign((args) => {
              resolveSettledRequest(args.context, args.event.output);

              return { resyncTicket: null, ...buildPendingPop(args.context) };
            }),
            guard: (args) => findNextRequestKind(args.context) === 'continuation',
            target: '#workerLifecycle.continuing',
          },
          {
            actions: assign((args) => {
              resolveSettledRequest(args.context, args.event.output);

              return { resyncTicket: null, ...buildPendingPop(args.context) };
            }),
            guard: (args) => findNextRequestKind(args.context) === 'eviction',
            target: '#workerLifecycle.evicting',
          },
          {
            actions: assign((args) => {
              resolveSettledRequest(args.context, args.event.output);

              return { resyncTicket: null, ...buildPendingPop(args.context) };
            }),
            guard: (args) => findNextRequestKind(args.context) === 'inline',
            target: '#workerLifecycle.inline',
          },
          {
            actions: assign((args) => {
              resolveSettledRequest(args.context, args.event.output);

              return { resyncTicket: null, ...buildPendingPop(args.context) };
            }),
            guard: hasLiveActivity,
            target: '#workerLifecycle.running',
          },
          {
            actions: assign((args) => {
              resolveSettledRequest(args.context, args.event.output);

              return { resyncTicket: null, ...buildPendingPop(args.context) };
            }),
            target: '#workerLifecycle.idle',
          },
        ],
        src: 'runResyncActor',
      },
    },
    running: { entry: assign({ phase: 'running' as const }) },
    starting: {
      entry: assign({ phase: 'starting' as const }),
      invoke: {
        input: (args) => ({
          context: args.context.runtime,
          request: getExpectedRequest(args.context.currentRequest, 'start'),
        }),
        onDone: [
          {
            actions: assign((args) => {
              resolveSettledRequest(args.context, args.event.output);

              return { ...buildPendingPop(args.context) };
            }),
            guard: (args) => findNextRequestKind(args.context) === 'start',
            reenter: true,
            target: '#workerLifecycle.starting',
          },
          {
            actions: assign((args) => {
              resolveSettledRequest(args.context, args.event.output);

              return { ...buildPendingPop(args.context) };
            }),
            guard: (args) => findNextRequestKind(args.context) === 'resync',
            target: '#workerLifecycle.resyncing',
          },
          {
            actions: assign((args) => {
              resolveSettledRequest(args.context, args.event.output);

              return { ...buildPendingPop(args.context) };
            }),
            guard: (args) => findNextRequestKind(args.context) === 'continuation',
            target: '#workerLifecycle.continuing',
          },
          {
            actions: assign((args) => {
              resolveSettledRequest(args.context, args.event.output);

              return { ...buildPendingPop(args.context) };
            }),
            guard: (args) => findNextRequestKind(args.context) === 'eviction',
            target: '#workerLifecycle.evicting',
          },
          {
            actions: assign((args) => {
              resolveSettledRequest(args.context, args.event.output);

              return { ...buildPendingPop(args.context) };
            }),
            guard: (args) => findNextRequestKind(args.context) === 'inline',
            target: '#workerLifecycle.inline',
          },
          {
            actions: assign((args) => {
              resolveSettledRequest(args.context, args.event.output);

              return { ...buildPendingPop(args.context) };
            }),
            guard: hasLiveActivity,
            target: '#workerLifecycle.running',
          },
          {
            actions: assign((args) => {
              resolveSettledRequest(args.context, args.event.output);

              return { ...buildPendingPop(args.context) };
            }),
            target: '#workerLifecycle.idle',
          },
        ],
        src: 'runStartActor',
      },
    },
    stopping: { entry: assign({ phase: 'stopping' as const }) },
  },
});
