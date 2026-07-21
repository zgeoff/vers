import type { ActorRef, Snapshot } from 'xstate';
import { assign, raise, setup } from 'xstate';
import { buildMachineTypes } from './build-machine-types';
import type { FlushOutcome } from './run-checkpoint-flush-attempt';
import { runCheckpointFlushAttempt } from './run-checkpoint-flush-attempt';
import { subscribeToShutdownAbort } from './subscribe-to-shutdown-abort';
import type { ActivityServiceClient } from './types';

interface CheckpointActivityContext {
  readonly activityID: string;
  readonly client: Pick<ActivityServiceClient, 'trackActivityProgress'>;
  readonly consecutiveFlushFailures: number;
  readonly expectedHead: number;
  readonly flushPending: boolean;
  readonly latestQueuedVersion: number | undefined;
  readonly onAcked: ((activityID: string, appendedHead: number) => void) | undefined;
  readonly onCapped: ((activityID: string, appendedHead: number) => void) | undefined;
  readonly onEvicted: ((activityID: string) => void) | undefined;
  readonly onFlushStalled:
    | ((activityID: string, reason: string, traceID: string) => void)
    | undefined;
  readonly onHeld: ((activityID: string) => void) | undefined;
  readonly onInvalid: (activityID: string, reason: string, traceID?: string) => void;
  readonly onRetryFailed: ((activityID: string, error: unknown) => void) | undefined;
  readonly onServerContact: (() => void) | undefined;
  readonly parentRef: ActorRef<Snapshot<unknown>, CheckpointActivitySettledEvent> | undefined;
  readonly retryAttempt: number;
  readonly retryTimings: { readonly maxTimeout: number; readonly minTimeout: number };
  readonly scheduleProgressFlush: () => void;
  readonly sessionEvicted: boolean;
  readonly signal: AbortSignal | undefined;
  readonly terminalQueued: boolean;
}

/**
 * The child machine's construction input, seeded once from the activity's registration and its
 * hydrated durable-queue tail — every field the flush attempt or its scheduling needs that isn't
 * carried by a later event.
 */
export interface CheckpointActivityInput {
  readonly activityID: string;
  readonly client: Pick<ActivityServiceClient, 'trackActivityProgress'>;
  readonly expectedHead: number;
  readonly latestQueuedVersion: number | undefined;
  readonly onAcked: ((activityID: string, appendedHead: number) => void) | undefined;
  readonly onCapped: ((activityID: string, appendedHead: number) => void) | undefined;
  readonly onEvicted: ((activityID: string) => void) | undefined;
  readonly onFlushStalled:
    | ((activityID: string, reason: string, traceID: string) => void)
    | undefined;
  readonly onHeld: ((activityID: string) => void) | undefined;
  readonly onInvalid: (activityID: string, reason: string, traceID?: string) => void;
  readonly onRetryFailed: ((activityID: string, error: unknown) => void) | undefined;
  readonly onServerContact: (() => void) | undefined;

  /**
   * The spawning machine's own ref, receiving this activity's settlement event. A machine driven
   * standalone — a test, or any future host — omits it, and settlement is simply not reported.
   */
  readonly parentRef?: ActorRef<Snapshot<unknown>, CheckpointActivitySettledEvent>;
  readonly retryTimings: { readonly maxTimeout: number; readonly minTimeout: number };
  readonly scheduleProgressFlush: () => void;
  readonly signal: AbortSignal | undefined;
  readonly terminalQueued: boolean;
}

/**
 * Notifies the checkpoint submitter's parent machine that this activity has settled into
 * `evicted` — a stream-stopping response or a fully drained terminal checkpoint —
 * `sessionEvicted` distinguishing a displaced writer (marked and reported until a fresh
 * registration supersedes it) from an ordinary stopped stream.
 */
export interface CheckpointActivitySettledEvent {
  readonly activityID: string;
  readonly sessionEvicted: boolean;
  readonly type: 'CHILD_SETTLED';
}

/**
 * A flush attempt's settled outcome restated as an internal machine event — raised from the
 * invoke's `onDone` so each variant routes through its own narrowed transition. Outcomes that
 * stop the stream with the queue discarded collapse into one `SETTLED_EVICTION` variant, since
 * they differ only in whether the writer was displaced.
 */
type FlushSettledEvent =
  | { readonly appendedHead: number; readonly type: 'SETTLED_CONFLICT' }
  | { readonly appendedHead: number; readonly type: 'SETTLED_SUCCESS' }
  | { readonly consecutiveFlushFailures: number; readonly type: 'SETTLED_TRANSPORT_FAILURE' }
  | {
      readonly appendedHead: number | undefined;
      readonly error: unknown;
      readonly type: 'SETTLED_CALLBACK_FAILED';
    }
  | { readonly sessionEvicted: boolean; readonly type: 'SETTLED_EVICTION' }
  | { readonly type: 'SETTLED_EMPTY' }
  | { readonly type: 'SETTLED_HELD_ERROR' }
  | { readonly type: 'SETTLED_INVALID' };

type CheckpointActivityEvent =
  | FlushSettledEvent
  | { readonly type: 'FLUSH_DUE' }
  | { readonly type: 'FLUSH_HELD' }
  | { readonly type: 'FLUSH_NOW' }
  | { readonly type: 'SIGNAL_ABORTED' }
  | { readonly isTerminal: boolean; readonly type: 'QUEUED'; readonly version: number };

/**
 * One activity's flush lifecycle: `idle` (nothing pending) → `scheduled` (a non-terminal
 * checkpoint armed the shared progress window) → `flushing` (one attempt in flight) →, on
 * failure, `retrying` (exponential backoff) until the batch lands, is rejected outright
 * (`invalid`), or the activity is displaced or drained (`evicted`). A flush request arriving in
 * `flushing` never cancels the in-flight attempt — it sets `flushPending`, which the transient
 * re-flush check on `idle` and `retrying` consumes, in the same macrostep as the attempt's
 * settlement, as an immediate re-flush.
 */
export const checkpointActivityMachine = setup({
  actors: { subscribeToShutdownAbort, runCheckpointFlushAttempt },
  delays: {
    retryDelay: (args: Readonly<{ context: CheckpointActivityContext }>) =>
      buildRetryBackoffMS(args.context.retryTimings, args.context.retryAttempt),
  },
  types: buildMachineTypes<{
    context: CheckpointActivityContext;
    events: CheckpointActivityEvent;
    input: CheckpointActivityInput;
  }>(),
}).createMachine({
  context: (args) => ({
    activityID: args.input.activityID,
    client: args.input.client,
    consecutiveFlushFailures: 0,
    expectedHead: args.input.expectedHead,
    flushPending: false,
    latestQueuedVersion: args.input.latestQueuedVersion,
    onAcked: args.input.onAcked,
    onCapped: args.input.onCapped,
    onEvicted: args.input.onEvicted,
    onFlushStalled: args.input.onFlushStalled,
    onHeld: args.input.onHeld,
    onInvalid: args.input.onInvalid,
    onRetryFailed: args.input.onRetryFailed,
    onServerContact: args.input.onServerContact,
    parentRef: args.input.parentRef,
    retryAttempt: 0,
    retryTimings: args.input.retryTimings,
    scheduleProgressFlush: args.input.scheduleProgressFlush,
    sessionEvicted: false,
    signal: args.input.signal,
    terminalQueued: args.input.terminalQueued,
  }),
  id: 'checkpointActivity',
  initial: 'idle',
  states: {
    evicted: {
      entry: emitSettlementToParent,
      type: 'final',
    },
    flushing: {
      invoke: {
        input: (args) => ({
          activityID: args.context.activityID,
          client: args.context.client,
          consecutiveFlushFailures: args.context.consecutiveFlushFailures,
          expectedHead: args.context.expectedHead,
          onAcked: args.context.onAcked,
          onCapped: args.context.onCapped,
          onEvicted: args.context.onEvicted,
          onFlushStalled: args.context.onFlushStalled,
          onInvalid: args.context.onInvalid,
          onServerContact: args.context.onServerContact,
        }),
        onDone: {
          actions: raise((args) => buildFlushSettledEvent(args.event.output)),
        },
        src: 'runCheckpointFlushAttempt',
      },
      on: {
        FLUSH_HELD: { actions: assign({ flushPending: true, retryAttempt: 0 }) },
        FLUSH_NOW: { actions: assign({ flushPending: true }) },
        QUEUED: {
          actions: assign((args) => ({
            ...buildQueuedContextUpdate({ context: args.context, event: args.event }),
            flushPending: true,
          })),
        },
        SETTLED_CALLBACK_FAILED: {
          actions: [
            (args) => {
              args.context.onRetryFailed?.(args.context.activityID, args.event.error);
            },
            assign({
              consecutiveFlushFailures: 0,
              expectedHead: (args) => args.event.appendedHead ?? args.context.expectedHead,
            }),
          ],
          target: 'idle',
        },
        SETTLED_CONFLICT: {
          actions: assign({
            consecutiveFlushFailures: 0,
            expectedHead: (args) => args.event.appendedHead,
            retryAttempt: 0,
          }),
          reenter: true,
          target: 'flushing',
        },
        SETTLED_EMPTY: { target: 'idle' },
        SETTLED_EVICTION: {
          actions: assign({
            consecutiveFlushFailures: 0,
            sessionEvicted: (args) => args.event.sessionEvicted,
          }),
          target: 'evicted',
        },
        SETTLED_HELD_ERROR: {
          actions: assign({ consecutiveFlushFailures: 0 }),
          target: 'retrying',
        },
        SETTLED_INVALID: {
          actions: assign({ consecutiveFlushFailures: 0 }),
          target: 'invalid',
        },
        SETTLED_SUCCESS: [
          {
            actions: assign({ consecutiveFlushFailures: 0 }),
            guard: (args) =>
              args.context.terminalQueued &&
              args.context.latestQueuedVersion !== undefined &&
              args.event.appendedHead >= args.context.latestQueuedVersion,
            target: 'evicted',
          },
          {
            actions: assign({
              consecutiveFlushFailures: 0,
              expectedHead: (args) => args.event.appendedHead,
              retryAttempt: 0,
            }),
            target: 'idle',
          },
        ],
        SETTLED_TRANSPORT_FAILURE: {
          actions: assign({
            consecutiveFlushFailures: (args) => args.event.consecutiveFlushFailures,
          }),
          target: 'retrying',
        },
      },
    },
    idle: {
      always: {
        actions: assign({ flushPending: false }),
        guard: (args) => args.context.flushPending,
        target: 'flushing',
      },
      on: {
        FLUSH_HELD: { actions: assign({ retryAttempt: 0 }), reenter: true, target: 'flushing' },
        FLUSH_NOW: { reenter: true, target: 'flushing' },
        QUEUED: [
          {
            actions: assign(buildQueuedContextUpdate),
            guard: (args) => args.event.isTerminal,
            reenter: true,
            target: 'flushing',
          },
          { actions: assign(buildQueuedContextUpdate), target: 'scheduled' },
        ],
      },
    },
    invalid: {},
    retrying: {
      after: {
        retryDelay: {
          actions: assign({ retryAttempt: (args) => args.context.retryAttempt + 1 }),
          reenter: true,
          target: 'flushing',
        },
      },
      always: {
        actions: assign({ flushPending: false }),
        guard: (args) => args.context.flushPending,
        target: 'flushing',
      },
      entry: (args) => {
        args.context.onHeld?.(args.context.activityID);
      },
      invoke: {
        input: (args) => ({ signal: args.context.signal }),
        src: 'subscribeToShutdownAbort',
      },
      on: {
        FLUSH_HELD: { actions: assign({ retryAttempt: 0 }), reenter: true, target: 'flushing' },
        FLUSH_NOW: { reenter: true, target: 'flushing' },
        QUEUED: { actions: assign(buildQueuedContextUpdate), reenter: true, target: 'flushing' },
        SIGNAL_ABORTED: { target: 'idle' },
      },
    },
    scheduled: {
      entry: (args) => {
        args.context.scheduleProgressFlush();
      },
      on: {
        FLUSH_DUE: { reenter: true, target: 'flushing' },
        FLUSH_HELD: { actions: assign({ retryAttempt: 0 }), reenter: true, target: 'flushing' },
        FLUSH_NOW: { reenter: true, target: 'flushing' },
        QUEUED: {
          actions: assign(buildQueuedContextUpdate),
          guard: (args) => args.event.isTerminal,
          reenter: true,
          target: 'flushing',
        },
      },
    },
  },
});

/**
 * Notifies the parent ref handed in at spawn, when there is one, that this activity has settled
 * into `evicted`. A machine started without a parent ref reports settlement nowhere — a no-op,
 * not an error.
 */
function emitSettlementToParent(args: Readonly<{ context: CheckpointActivityContext }>): void {
  args.context.parentRef?.send({
    activityID: args.context.activityID,
    sessionEvicted: args.context.sessionEvicted,
    type: 'CHILD_SETTLED',
  } satisfies CheckpointActivitySettledEvent);
}

/**
 * Restates a flush attempt's outcome as its internal `SETTLED_*` machine event, carrying only the
 * fields the receiving transition acts on.
 */
function buildFlushSettledEvent(outcome: FlushOutcome): FlushSettledEvent {
  switch (outcome.type) {
    case 'callback-failed': {
      return {
        appendedHead: outcome.appendedHead,
        error: outcome.error,
        type: 'SETTLED_CALLBACK_FAILED',
      };
    }
    case 'capped':
    case 'not-found':
    case 'terminal': {
      return { sessionEvicted: false, type: 'SETTLED_EVICTION' };
    }
    case 'conflict': {
      return { appendedHead: outcome.appendedHead, type: 'SETTLED_CONFLICT' };
    }
    case 'empty': {
      return { type: 'SETTLED_EMPTY' };
    }
    case 'held-defined-error': {
      return { type: 'SETTLED_HELD_ERROR' };
    }
    case 'invalid': {
      return { type: 'SETTLED_INVALID' };
    }
    case 'session-evicted': {
      return { sessionEvicted: true, type: 'SETTLED_EVICTION' };
    }
    case 'success': {
      return { appendedHead: outcome.appendedHead, type: 'SETTLED_SUCCESS' };
    }
    case 'transport-failure': {
      return {
        consecutiveFlushFailures: outcome.consecutiveFlushFailures,
        type: 'SETTLED_TRANSPORT_FAILURE',
      };
    }
  }
}

/**
 * Applies one `QUEUED` event to context: the latest known queued version always advances, and
 * `terminalQueued` latches true — a hydrated or live terminal checkpoint never un-marks the
 * activity for eviction once its flush drains.
 */
function buildQueuedContextUpdate(
  args: Readonly<{
    context: Readonly<CheckpointActivityContext>;
    event: Readonly<Extract<CheckpointActivityEvent, { type: 'QUEUED' }>>;
  }>,
): Pick<CheckpointActivityContext, 'latestQueuedVersion' | 'terminalQueued'> {
  return {
    latestQueuedVersion: args.event.version,
    terminalQueued: args.context.terminalQueued || args.event.isTerminal,
  };
}

/**
 * `min(base * 2^attempt, cap)`, no jitter — parity with `p-retry`'s `factor: 2` backoff: the first
 * retry (`attempt` 0) waits a full base window.
 */
function buildRetryBackoffMS(
  retryTimings: Readonly<{ maxTimeout: number; minTimeout: number }>,
  attempt: number,
): number {
  return Math.min(retryTimings.minTimeout * 2 ** attempt, retryTimings.maxTimeout);
}
