import { ORPCError, isDefinedError, safe } from '@orpc/client';
import { buildTraceparent, createTraceContext } from '@vers/trace';
import { fromPromise } from 'xstate';
import type { IngestActivityStartOutcome } from './ingest-activity-start';
import { readQueuedCheckpoints } from './read-queued-checkpoints';
import { removeConfirmedCheckpoints } from './remove-confirmed-checkpoints';
import { removeQueuedCheckpoints } from './remove-queued-checkpoints';
import type { ActivityServiceClient } from './types';

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

  readonly ingestActivityStart:
    | ((activityID: string) => Promise<IngestActivityStartOutcome>)
    | undefined;

  readonly onAcked: ((activityID: string, appendedHead: number) => void) | undefined;
  readonly onCapped: ((activityID: string, appendedHead: number) => void) | undefined;
  readonly onEvicted: ((activityID: string) => void) | undefined;
  readonly onInvalid: (activityID: string, reason: string, traceID?: string) => void;
  readonly onServerContact: (() => void) | undefined;
}

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
      let retriedAfterIngest = false;

      // The body sends the same batch again only once, after a NOT_FOUND ingests the activity's
      // still-pending client-minted activity start — `retriedAfterIngest` turns a second NOT_FOUND
      // into an unconditional discard rather than ingesting again.
      while (true) {
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

        if (error.code !== 'NOT_FOUND') {
          return { type: 'held-defined-error' };
        }

        if (retriedAfterIngest || input.ingestActivityStart === undefined) {
          await removeQueuedCheckpoints(input.activityID);

          return { type: 'not-found' };
        }

        const ingestOutcome = await input.ingestActivityStart(input.activityID);

        // NOT_FOUND was a defined reply, so `onServerContact` fired, but the start cannot ingest
        // yet; hold the queue for retry without feeding the stall counter a genuinely unanswered
        // flush owns
        if (ingestOutcome === 'deferred') {
          return { type: 'held-defined-error' };
        }

        if (ingestOutcome === 'rejected') {
          await removeQueuedCheckpoints(input.activityID);

          return { type: 'not-found' };
        }

        // ingested or absent: the row now exists at head 0 server-side, so retry the same batch
        // once; a genuinely gone activity NOT_FOUNDs again and discards under the guard, never
        // ingesting twice
        retriedAfterIngest = true;
      }
    } catch (error) {
      return { appendedHead: settledHead, error, type: 'callback-failed' };
    } finally {
      if (serverAnswered) {
        input.onServerContact?.();
      }
    }
  },
);
