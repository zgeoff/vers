import type { ActorRef, Snapshot } from 'xstate';
import { assign, emit, enqueueActions, raise, setup } from 'xstate';
import { buildMachineTypes } from './build-machine-types';
import { FLUSH_STALL_THRESHOLD } from './constants';
import type { IngestActivityStartOutcome } from './ingest-activity-start';
import type { FlushOutcome } from './run-checkpoint-flush-attempt';
import { runCheckpointFlushAttempt } from './run-checkpoint-flush-attempt';
import { subscribeToShutdownAbort } from './subscribe-to-shutdown-abort';
import type { ActivityServiceClient } from './types';

type HoldCause = 'deferred' | 'transport';

interface CheckpointActivityContext {
  readonly activityID: string;
  readonly client: Pick<ActivityServiceClient, 'trackActivityProgress'>;
  readonly consecutiveFlushFailures: number;
  readonly expectedHead: number;
  readonly flushPending: boolean;
  readonly holdCause: HoldCause;
  readonly ingestActivityStart:
    | ((activityID: string) => Promise<IngestActivityStartOutcome>)
    | undefined;
  readonly latestQueuedVersion: number | undefined;
  readonly onAcked: ((activityID: string, appendedHead: number) => void) | undefined;
  readonly onCapped: ((activityID: string, appendedHead: number) => void) | undefined;
  readonly onEvicted: ((activityID: string) => void) | undefined;
  readonly onInvalid: (activityID: string, reason: string, traceID?: string) => void;
  readonly onServerContact: (() => void) | undefined;
  readonly parentRef: ActorRef<Snapshot<unknown>, CheckpointActivitySettledEvent> | undefined;
  readonly retryAttempt: number;
  readonly retryTimings: { readonly maxTimeout: number; readonly minTimeout: number };
  readonly scheduleProgressFlush: () => void;
  readonly sessionEvicted: boolean;
  readonly signal: AbortSignal | undefined;
  readonly terminalQueued: boolean;
}

export interface CheckpointActivityInput {
  readonly activityID: string;
  readonly client: Pick<ActivityServiceClient, 'trackActivityProgress'>;
  readonly expectedHead: number;
  readonly ingestActivityStart:
    | ((activityID: string) => Promise<IngestActivityStartOutcome>)
    | undefined;
  readonly latestQueuedVersion: number | undefined;
  readonly onAcked: ((activityID: string, appendedHead: number) => void) | undefined;
  readonly onCapped: ((activityID: string, appendedHead: number) => void) | undefined;
  readonly onEvicted: ((activityID: string) => void) | undefined;
  readonly onInvalid: (activityID: string, reason: string, traceID?: string) => void;
  readonly onServerContact: (() => void) | undefined;

  readonly parentRef?: ActorRef<Snapshot<unknown>, CheckpointActivitySettledEvent>;
  readonly retryTimings: { readonly maxTimeout: number; readonly minTimeout: number };
  readonly scheduleProgressFlush: () => void;
  readonly signal: AbortSignal | undefined;
  readonly terminalQueued: boolean;
}

export interface CheckpointActivitySettledEvent {
  readonly activityID: string;
  readonly sessionEvicted: boolean;
  readonly type: 'CHILD_SETTLED';
}

type FlushSettledEvent =
  | { readonly appendedHead: number; readonly type: 'SETTLED_CONFLICT' }
  | { readonly appendedHead: number; readonly type: 'SETTLED_SUCCESS' }
  | {
      readonly reason: string;
      readonly traceID: string;
      readonly type: 'SETTLED_TRANSPORT_FAILURE';
    }
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

export type CheckpointActivityEmittedEvent =
  | { readonly activityID: string; readonly error: unknown; readonly type: 'retryFailed' }
  | { readonly activityID: string; readonly type: 'held' }
  | {
      readonly activityID: string;
      readonly reason: string;
      readonly traceID: string;
      readonly type: 'flushStalled';
    };

export const checkpointActivityMachine = setup({
  actors: { subscribeToShutdownAbort, runCheckpointFlushAttempt },
  delays: {
    retryDelay: (args: Readonly<{ context: CheckpointActivityContext }>) =>
      buildRetryBackoffMS(args.context.retryTimings, args.context.retryAttempt),
  },
  types: buildMachineTypes<{
    context: CheckpointActivityContext;
    emitted: CheckpointActivityEmittedEvent;
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
    holdCause: 'transport',
    ingestActivityStart: args.input.ingestActivityStart,
    latestQueuedVersion: args.input.latestQueuedVersion,
    onAcked: args.input.onAcked,
    onCapped: args.input.onCapped,
    onEvicted: args.input.onEvicted,
    onInvalid: args.input.onInvalid,
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
          expectedHead: args.context.expectedHead,
          ingestActivityStart: args.context.ingestActivityStart,
          onAcked: args.context.onAcked,
          onCapped: args.context.onCapped,
          onEvicted: args.context.onEvicted,
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
            flushPending: args.context.flushPending || args.event.isTerminal,
          })),
        },
        SETTLED_CALLBACK_FAILED: {
          actions: [
            emit((args) => ({
              activityID: args.context.activityID,
              error: args.event.error,
              type: 'retryFailed',
            })),
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
          actions: assign({ consecutiveFlushFailures: 0, holdCause: 'deferred' as const }),
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
            guard: (args) =>
              !args.context.flushPending &&
              args.context.latestQueuedVersion !== undefined &&
              args.context.latestQueuedVersion > args.event.appendedHead,
            target: 'scheduled',
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
          actions: enqueueActions((args) => {
            const consecutiveFlushFailures = args.context.consecutiveFlushFailures + 1;

            args.enqueue.assign({ consecutiveFlushFailures, holdCause: 'transport' as const });

            if (consecutiveFlushFailures === FLUSH_STALL_THRESHOLD) {
              args.enqueue.emit({
                activityID: args.context.activityID,
                reason: args.event.reason,
                traceID: args.event.traceID,
                type: 'flushStalled',
              });
            }
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

      // a deferred hold is a server answer, so it is not reported as held: the worker reads held
      // as a lost connection and would treat the next answer as a reconnect, re-flushing at once
      entry: enqueueActions((args) => {
        if (args.context.holdCause === 'transport') {
          args.enqueue.emit({ activityID: args.context.activityID, type: 'held' });
        }
      }),
      invoke: {
        input: (args) => ({ signal: args.context.signal }),
        src: 'subscribeToShutdownAbort',
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
          { actions: assign(buildQueuedContextUpdate) },
        ],
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

function emitSettlementToParent(args: Readonly<{ context: CheckpointActivityContext }>): void {
  args.context.parentRef?.send({
    activityID: args.context.activityID,
    sessionEvicted: args.context.sessionEvicted,
    type: 'CHILD_SETTLED',
  } satisfies CheckpointActivitySettledEvent);
}

function buildFlushSettledEvent(outcome: FlushOutcome): FlushSettledEvent {
  if (outcome.type === 'callback-failed') {
    return {
      appendedHead: outcome.appendedHead,
      error: outcome.error,
      type: 'SETTLED_CALLBACK_FAILED',
    };
  }

  if (outcome.type === 'capped' || outcome.type === 'not-found' || outcome.type === 'terminal') {
    return { sessionEvicted: false, type: 'SETTLED_EVICTION' };
  }

  if (outcome.type === 'conflict') {
    return { appendedHead: outcome.appendedHead, type: 'SETTLED_CONFLICT' };
  }

  if (outcome.type === 'empty') {
    return { type: 'SETTLED_EMPTY' };
  }

  if (outcome.type === 'held-defined-error') {
    return { type: 'SETTLED_HELD_ERROR' };
  }

  if (outcome.type === 'invalid') {
    return { type: 'SETTLED_INVALID' };
  }

  if (outcome.type === 'session-evicted') {
    return { sessionEvicted: true, type: 'SETTLED_EVICTION' };
  }

  if (outcome.type === 'success') {
    return { appendedHead: outcome.appendedHead, type: 'SETTLED_SUCCESS' };
  }

  return { reason: outcome.reason, traceID: outcome.traceID, type: 'SETTLED_TRANSPORT_FAILURE' };
}

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

function buildRetryBackoffMS(
  retryTimings: Readonly<{ maxTimeout: number; minTimeout: number }>,
  attempt: number,
): number {
  return Math.min(retryTimings.minTimeout * 2 ** attempt, retryTimings.maxTimeout);
}
