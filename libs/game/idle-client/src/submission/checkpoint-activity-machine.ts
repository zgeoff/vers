import { ORPCError, isDefinedError, safe } from '@orpc/client';
import { buildTraceparent, createTraceContext } from '@vers/trace';
import type { ActorRef, Snapshot } from 'xstate';
import { assign, fromCallback, fromPromise, setup } from 'xstate';
import { buildMachineTypes } from './build-machine-types';
import { FLUSH_STALL_THRESHOLD } from './constants';
import { readQueuedCheckpoints } from './read-queued-checkpoints';
import { removeConfirmedCheckpoints } from './remove-confirmed-checkpoints';
import { removeQueuedCheckpoints } from './remove-queued-checkpoints';
import type { ActivityServiceClient } from './types';

/**
 * The one invoked flush attempt's settled outcome, routing every `flushing` transition. Every
 * variant that reflects a server answer (`success`, `capped`, `terminal`, `session-evicted`,
 * `conflict`, `invalid`, `not-found`, `held-defined-error`) has already settled the local queue and
 * cursor and called its public callback by the time it resolves; `callback-failed` reports that a
 * settled outcome's own callback threw.
 */
type FlushOutcome =
  | { readonly appendedHead: number; readonly type: 'capped' }
  | { readonly appendedHead: number; readonly type: 'conflict' }
  | { readonly appendedHead: number; readonly type: 'success' }
  | {
      readonly consecutiveFlushFailures: number;
      readonly reason: string;
      readonly traceID: string;
      readonly type: 'transport-failure';
    }
  | {
      readonly appendedHead: number | undefined;
      readonly error: unknown;
      readonly type: 'callback-failed';
    }
  | { readonly reason: string; readonly type: 'invalid' }
  | { readonly type: 'empty' }
  | { readonly type: 'held-defined-error' }
  | { readonly type: 'not-found' }
  | { readonly type: 'session-evicted' }
  | { readonly type: 'terminal' };

interface FlushAttemptInput {
  readonly activityID: string;
  readonly client: Pick<ActivityServiceClient, 'trackActivityProgress'>;
  readonly consecutiveFlushFailures: number;
  readonly expectedHead: number;
  readonly onAcked: ((activityID: string, appendedHead: number) => void) | undefined;
  readonly onCapped: ((activityID: string, appendedHead: number) => void) | undefined;
  readonly onEvicted: ((activityID: string) => void) | undefined;
  readonly onFlushStalled:
    | ((activityID: string, reason: string, traceID: string) => void)
    | undefined;
  readonly onInvalid: (activityID: string, reason: string, traceID?: string) => void;
  readonly onServerContact: (() => void) | undefined;
}

/**
 * Runs one checkpoint batch delivery attempt end to end: the durable queue read, the oRPC call,
 * every queue/cursor settlement the response implies, and the response's public callback — all
 * awaited before this resolves, so a caller observing this attempt's outcome never races the next
 * one. Never rejects: a callback throwing after the server answered resolves as `callback-failed`
 * rather than propagating, so the machine can hold the batch without an unhandled rejection.
 */
const runCheckpointFlushAttempt = fromPromise<FlushOutcome, FlushAttemptInput>(async (args) => {
  const input = args.input;
  let serverAnswered = false;
  let settledHead: number | undefined;

  try {
    const rows = await readQueuedCheckpoints(input.activityID);

    if (rows.length === 0) {
      return { type: 'empty' };
    }

    const trace = createTraceContext();

    const [error, result] = await safe(
      input.client.trackActivityProgress(
        { activityID: input.activityID, checkpoints: rows, expectedHead: input.expectedHead },
        { context: { traceparent: buildTraceparent(trace) } },
      ),
    );

    if (error === null) {
      serverAnswered = true;

      await removeConfirmedCheckpoints(input.activityID, result.appendedHead);

      settledHead = result.appendedHead;
      input.onAcked?.(input.activityID, result.appendedHead);

      return { appendedHead: result.appendedHead, type: 'success' };
    }

    if (!isDefinedError(error)) {
      const reason = error instanceof ORPCError ? `${error.code}: ${error.message}` : String(error);
      const consecutiveFlushFailures = input.consecutiveFlushFailures + 1;

      if (consecutiveFlushFailures === FLUSH_STALL_THRESHOLD) {
        input.onFlushStalled?.(input.activityID, reason, trace.traceID);
      }

      return {
        consecutiveFlushFailures,
        reason,
        traceID: trace.traceID,
        type: 'transport-failure',
      };
    }

    serverAnswered = true;

    if (error.code === 'ACTIVITY_CAPPED') {
      await removeQueuedCheckpoints(input.activityID);

      input.onCapped?.(input.activityID, error.data.appendedHead);

      return { appendedHead: error.data.appendedHead, type: 'capped' };
    }

    if (error.code === 'ACTIVITY_TERMINAL') {
      await removeQueuedCheckpoints(input.activityID);

      if (error.data.status === 'capped') {
        input.onCapped?.(input.activityID, error.data.appendedHead);
      }

      return { type: 'terminal' };
    }

    if (error.code === 'SESSION_EVICTED') {
      await removeQueuedCheckpoints(input.activityID);

      input.onEvicted?.(input.activityID);

      return { type: 'session-evicted' };
    }

    if (error.code === 'CONFLICT') {
      await removeConfirmedCheckpoints(input.activityID, error.data.appendedHead);

      return { appendedHead: error.data.appendedHead, type: 'conflict' };
    }

    if (error.code === 'CHECKPOINT_INVALID') {
      input.onInvalid(input.activityID, error.data.reason, trace.traceID);

      return { reason: error.data.reason, type: 'invalid' };
    }

    if (error.code === 'NOT_FOUND') {
      await removeQueuedCheckpoints(input.activityID);

      return { type: 'not-found' };
    }

    return { type: 'held-defined-error' };
  } catch (error) {
    return { appendedHead: settledHead, error, type: 'callback-failed' };
  } finally {
    if (serverAnswered) {
      input.onServerContact?.();
    }
  }
});

/**
 * Bridges an external `AbortSignal` into the machine while `retrying` is active — sending
 * `SIGNAL_ABORTED` once, then detaching. Never sent at all when no signal was configured.
 */
const subscribeToShutdownAbort = fromCallback<
  { type: 'SIGNAL_ABORTED' },
  { readonly signal: AbortSignal | undefined }
>((args) => {
  const input = args.input;

  if (input.signal === undefined) {
    return () => {};
  }

  if (input.signal.aborted) {
    args.sendBack({ type: 'SIGNAL_ABORTED' });

    return () => {};
  }

  const onAbort = (): void => {
    args.sendBack({ type: 'SIGNAL_ABORTED' });
  };

  input.signal.addEventListener('abort', onAbort, { once: true });

  return () => {
    input.signal?.removeEventListener('abort', onAbort);
  };
});

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

type CheckpointActivityEvent =
  | { readonly type: 'FLUSH_DUE' }
  | { readonly type: 'FLUSH_HELD' }
  | { readonly type: 'FLUSH_NOW' }
  | { readonly type: 'SIGNAL_ABORTED' }
  | { readonly isTerminal: boolean; readonly type: 'QUEUED'; readonly version: number };

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

/**
 * One activity's flush lifecycle: `idle` (nothing pending) → `scheduled` (a non-terminal
 * checkpoint armed the shared progress window) → `flushing` (one attempt in flight) →, on
 * failure, `retrying` (exponential backoff) until the batch lands, is rejected outright
 * (`invalid`), or the activity is displaced or drained (`evicted`). A flush request arriving in
 * `flushing` never cancels the in-flight attempt — it marks a fold-in flag consumed, in the same
 * macrostep as the attempt's completion, as an immediate re-flush.
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
        onDone: [
          {
            actions: assign({
              consecutiveFlushFailures: 0,
              expectedHead: (args) =>
                args.event.output.type === 'success'
                  ? args.event.output.appendedHead
                  : args.context.expectedHead,
              sessionEvicted: false,
            }),
            guard: (args) =>
              args.event.output.type === 'success' &&
              args.context.terminalQueued &&
              args.context.latestQueuedVersion !== undefined &&
              args.event.output.appendedHead >= args.context.latestQueuedVersion,
            target: 'evicted',
          },
          {
            actions: assign({
              consecutiveFlushFailures: 0,
              expectedHead: (args) =>
                args.event.output.type === 'capped'
                  ? args.event.output.appendedHead
                  : args.context.expectedHead,
              sessionEvicted: (args) => args.event.output.type === 'session-evicted',
            }),
            guard: (args) =>
              args.event.output.type === 'capped' ||
              args.event.output.type === 'terminal' ||
              args.event.output.type === 'session-evicted' ||
              args.event.output.type === 'not-found',
            target: 'evicted',
          },
          {
            actions: assign({ consecutiveFlushFailures: 0 }),
            guard: (args) => args.event.output.type === 'invalid',
            target: 'invalid',
          },
          {
            actions: assign({
              consecutiveFlushFailures: 0,
              expectedHead: (args) =>
                args.event.output.type === 'conflict'
                  ? args.event.output.appendedHead
                  : args.context.expectedHead,
              retryAttempt: 0,
            }),
            guard: (args) => args.event.output.type === 'conflict',
            reenter: true,
            target: 'flushing',
          },
          {
            actions: [
              (args) => {
                args.context.onHeld?.(args.context.activityID);
              },
              assign({
                consecutiveFlushFailures: (args) =>
                  args.event.output.type === 'transport-failure'
                    ? args.event.output.consecutiveFlushFailures
                    : args.context.consecutiveFlushFailures,
                flushPending: false,
              }),
            ],
            guard: (args) =>
              args.event.output.type === 'transport-failure' && args.context.flushPending,
            reenter: true,
            target: 'flushing',
          },
          {
            actions: assign({
              consecutiveFlushFailures: (args) =>
                args.event.output.type === 'transport-failure'
                  ? args.event.output.consecutiveFlushFailures
                  : args.context.consecutiveFlushFailures,
            }),
            guard: (args) => args.event.output.type === 'transport-failure',
            target: 'retrying',
          },
          {
            actions: [
              (args) => {
                args.context.onHeld?.(args.context.activityID);
              },
              assign({ consecutiveFlushFailures: 0, flushPending: false }),
            ],
            guard: (args) =>
              args.event.output.type === 'held-defined-error' && args.context.flushPending,
            reenter: true,
            target: 'flushing',
          },
          {
            actions: assign({ consecutiveFlushFailures: 0 }),
            guard: (args) => args.event.output.type === 'held-defined-error',
            target: 'retrying',
          },
          {
            actions: [
              (args) => {
                if (args.event.output.type === 'callback-failed') {
                  args.context.onRetryFailed?.(args.context.activityID, args.event.output.error);
                }
              },
              assign({
                consecutiveFlushFailures: 0,
                expectedHead: (args) =>
                  args.event.output.type === 'callback-failed' &&
                  args.event.output.appendedHead !== undefined
                    ? args.event.output.appendedHead
                    : args.context.expectedHead,
                flushPending: false,
              }),
            ],
            guard: (args) =>
              args.event.output.type === 'callback-failed' && args.context.flushPending,
            reenter: true,
            target: 'flushing',
          },
          {
            actions: [
              (args) => {
                if (args.event.output.type === 'callback-failed') {
                  args.context.onRetryFailed?.(args.context.activityID, args.event.output.error);
                }
              },
              assign({
                consecutiveFlushFailures: 0,
                expectedHead: (args) =>
                  args.event.output.type === 'callback-failed' &&
                  args.event.output.appendedHead !== undefined
                    ? args.event.output.appendedHead
                    : args.context.expectedHead,
              }),
            ],
            guard: (args) => args.event.output.type === 'callback-failed',
            target: 'idle',
          },
          {
            actions: assign({
              consecutiveFlushFailures: 0,
              expectedHead: (args) =>
                args.event.output.type === 'success'
                  ? args.event.output.appendedHead
                  : args.context.expectedHead,
              flushPending: false,
              retryAttempt: 0,
            }),
            guard: (args) => args.event.output.type === 'success' && args.context.flushPending,
            reenter: true,
            target: 'flushing',
          },
          {
            actions: assign({
              consecutiveFlushFailures: 0,
              expectedHead: (args) =>
                args.event.output.type === 'success'
                  ? args.event.output.appendedHead
                  : args.context.expectedHead,
              retryAttempt: 0,
            }),
            guard: (args) => args.event.output.type === 'success',
            target: 'idle',
          },
          {
            actions: assign({ flushPending: false }),
            guard: (args) => args.event.output.type === 'empty' && args.context.flushPending,
            reenter: true,
            target: 'flushing',
          },
          { target: 'idle' },
        ],
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
      },
    },
    idle: {
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
