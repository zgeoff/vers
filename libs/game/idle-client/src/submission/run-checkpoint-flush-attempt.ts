import { ORPCError, isDefinedError, safe } from '@orpc/client';
import { buildTraceparent, createTraceContext } from '@vers/trace';
import { fromPromise } from 'xstate';
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
export type FlushOutcome =
  | { readonly appendedHead: number; readonly type: 'capped' }
  | { readonly appendedHead: number; readonly type: 'conflict' }
  | { readonly appendedHead: number; readonly type: 'success' }
  | { readonly reason: string; readonly traceID: string; readonly type: 'transport-failure' }
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
  readonly expectedHead: number;
  readonly onAcked: ((activityID: string, appendedHead: number) => void) | undefined;
  readonly onCapped: ((activityID: string, appendedHead: number) => void) | undefined;
  readonly onEvicted: ((activityID: string) => void) | undefined;
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
export const runCheckpointFlushAttempt = fromPromise<FlushOutcome, FlushAttemptInput>(
  async (args) => {
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
        const reason =
          error instanceof ORPCError ? `${error.code}: ${error.message}` : String(error);

        return { reason, traceID: trace.traceID, type: 'transport-failure' };
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
  },
);
