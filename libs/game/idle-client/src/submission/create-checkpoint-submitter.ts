import { ORPCError, isDefinedError, safe } from '@orpc/client';
import type { ActivityCheckpoint } from '@vers/idle-core';
import { ActivityCheckpointType } from '@vers/idle-core';
import invariant from 'tiny-invariant';
import { buildCheckpointBatchEntry } from './build-checkpoint-batch-entry';
import {
  ENTROPY_SOURCE_SERVER_KEY,
  FLUSH_STALL_THRESHOLD,
  PROGRESS_FLUSH_INTERVAL_MS,
} from './constants';
import { createTraceparent } from './create-traceparent';
import { readQueuedCheckpoints } from './read-queued-checkpoints';
import { removeConfirmedCheckpoints } from './remove-confirmed-checkpoints';
import { removeQueuedCheckpoints } from './remove-queued-checkpoints';
import type { ActivityServiceClient, ActivitySubmissionContext } from './types';
import { writeQueuedCheckpoint } from './write-queued-checkpoint';

interface ActivityState {
  consecutiveFlushFailures: number;
  expectedHead: number;
  flushPending: boolean;
  flushScheduled: boolean;
  inFlight: boolean;
  invalid: boolean;
  nextVersion: number;
  prevHash: string;
  previousNextSeed: string;
  startChainIndex: number;
}

export interface CheckpointSubmitter {
  /**
   * Seeds an activity's chain-link cursor from its head row; the call that first registers the
   * activity also resends whatever the durable queue still holds pending for it. Idempotent per
   * activity — every call this worker lifetime shares one seeding, so concurrent registrations
   * from separate tabs resolve together and none clobbers an in-progress cursor or piles on
   * extra resends. A failed seed read stops the activity's stream through `onInvalid`.
   */
  registerActivity: (context: Readonly<ActivitySubmissionContext>) => Promise<void>;

  /**
   * Maps and enqueues one engine checkpoint for a previously attached activity, then schedules a
   * flush: immediately for a terminal checkpoint, otherwise on the shared progress window.
   * Waits for the activity's registration to finish seeding the cursor, so a checkpoint produced
   * while the seed read is still in flight never chains onto a stale hash. Silently drops the
   * checkpoint if the activity was never attached or its stream is stopped. Resolves once the
   * checkpoint is durably queued, so a caller that awaits each submission in order never races a
   * later checkpoint's write against an earlier one's. Resolves with the activity-relative version
   * assigned to the queued entry, or `undefined` when the checkpoint was dropped.
   */
  submit: (
    activityID: string,
    checkpoint: Readonly<ActivityCheckpoint>,
  ) => Promise<number | undefined>;
}

interface CreateCheckpointSubmitterOptions {
  readonly client: Pick<ActivityServiceClient, 'trackActivityProgress'>;

  /**
   * Called after every successful flush with the server's fresh appended head — the caller's
   * authoritative last-contact signal, anchoring its view of the offline-progress budget.
   */
  readonly onAcked?: (activityID: string, appendedHead: number) => void;

  /**
   * Called once the server caps an activity, with the exact head the stream stopped at — the
   * index the caller rebases from after a resync. Fires whether this submitter's own batch
   * tripped the cap or a resend answered with the already-capped status.
   */
  readonly onCapped?: (activityID: string, appendedHead: number) => void;

  /**
   * Called once an activity's flush has failed to reach the service `FLUSH_STALL_THRESHOLD`
   * times in a row — a transport failure or an undeclared server error each count, an answered
   * request resets the streak. Telemetry only: the stream stays live, its queue intact, and later
   * flushes keep retrying. `traceID` names the failed attempt's trace for log correlation.
   */
  readonly onFlushStalled?: (activityID: string, reason: string, traceID: string) => void;

  /**
   * Called once a `CHECKPOINT_INVALID` response stops an activity's stream, so the caller can
   * notify connected tabs and report the rejection. `traceID` names the rejecting request's
   * trace; a stream stopped by a local failure carries none.
   */
  readonly onInvalid: (activityID: string, reason: string, traceID?: string) => void;

  /**
   * Schedules a non-terminal checkpoint's deferred progress-window flush. Defaults to a
   * `PROGRESS_FLUSH_INTERVAL_MS` timer; a test injects a capturing stub to drive the window
   * without waiting on real time, awaiting the returned flush to drain it deterministically.
   */
  readonly scheduleFlush?: (flush: () => Promise<void>) => void;
}

/**
 * Owns a worker's outbound checkpoint submissions: mapping, the durable queue, and one serialized
 * in-flight batch per activity. Response handling follows the activity service's response
 * contract: a fresh head on success or `CONFLICT` advances the cursor and confirms the queue up to
 * it; `CHECKPOINT_INVALID` and `NOT_FOUND` stop the stream (keeping and discarding its queue rows,
 * respectively); `ACTIVITY_CAPPED`, `ACTIVITY_TERMINAL`, and `SESSION_EVICTED` stop the stream and
 * discard its rows — the server accepts nothing further for it; anything else — `UNAUTHORIZED` or
 * a transport failure — holds the queue untouched for the next flush tick. Each flush rides a
 * freshly minted trace, and a streak of unanswered flushes reports a stall without stopping the
 * stream.
 */
export function createCheckpointSubmitter(
  options: Readonly<CreateCheckpointSubmitterOptions>,
): CheckpointSubmitter {
  const activityStates = new Map<string, ActivityState>();
  const registrations = new Map<string, Promise<void>>();

  const scheduleFlush: (flush: () => Promise<void>) => void =
    options.scheduleFlush ??
    ((flush) => {
      setTimeout(() => {
        void flush();
      }, PROGRESS_FLUSH_INTERVAL_MS);
    });

  const flush = async (activityID: string): Promise<void> => {
    const state = activityStates.get(activityID);

    if (state === undefined || state.invalid) {
      return;
    }

    if (state.inFlight) {
      state.flushPending = true;

      return;
    }

    state.inFlight = true;

    try {
      const rows = await readQueuedCheckpoints(activityID);

      if (rows.length === 0) {
        return;
      }

      const trace = createTraceparent();

      const [error, result] = await safe(
        options.client.trackActivityProgress(
          {
            activityID,
            checkpoints: rows,
            expectedHead: state.expectedHead,
          },
          { context: { traceparent: trace.traceparent } },
        ),
      );

      if (error === null) {
        state.consecutiveFlushFailures = 0;

        await removeConfirmedCheckpoints(activityID, result.appendedHead);

        state.expectedHead = result.appendedHead;
        options.onAcked?.(activityID, result.appendedHead);

        return;
      }

      if (!isDefinedError(error)) {
        state.consecutiveFlushFailures += 1;

        if (state.consecutiveFlushFailures === FLUSH_STALL_THRESHOLD) {
          const reason =
            error instanceof ORPCError ? `${error.code}: ${error.message}` : String(error);

          options.onFlushStalled?.(activityID, reason, trace.traceID);
        }

        return;
      }

      // a defined error is an answered request: the service is reachable, so the stall streak ends
      state.consecutiveFlushFailures = 0;

      if (error.code === 'ACTIVITY_CAPPED') {
        state.invalid = true;

        await removeQueuedCheckpoints(activityID);

        options.onCapped?.(activityID, error.data.appendedHead);

        return;
      }

      if (error.code === 'ACTIVITY_TERMINAL') {
        state.invalid = true;

        await removeQueuedCheckpoints(activityID);

        if (error.data.status === 'capped') {
          options.onCapped?.(activityID, error.data.appendedHead);
        }

        return;
      }

      if (error.code === 'SESSION_EVICTED') {
        state.invalid = true;

        await removeQueuedCheckpoints(activityID);

        return;
      }

      if (error.code === 'CONFLICT') {
        await removeConfirmedCheckpoints(activityID, error.data.appendedHead);

        state.expectedHead = error.data.appendedHead;
        state.flushPending = true;

        return;
      }

      if (error.code === 'CHECKPOINT_INVALID') {
        state.invalid = true;

        options.onInvalid(activityID, error.data.reason, trace.traceID);

        return;
      }

      if (error.code === 'NOT_FOUND') {
        state.invalid = true;

        await removeQueuedCheckpoints(activityID);
      }
    } finally {
      state.inFlight = false;

      if (state.flushPending) {
        state.flushPending = false;

        await flush(activityID);
      }
    }
  };

  const createActivityState = async (
    context: Readonly<ActivitySubmissionContext>,
  ): Promise<void> => {
    const state: ActivityState = {
      consecutiveFlushFailures: 0,
      expectedHead: context.appendedHead,
      flushPending: false,
      flushScheduled: false,
      inFlight: false,
      invalid: false,
      nextVersion: context.appendedHead + 1,
      prevHash: context.lastHash,
      previousNextSeed: context.previousNextSeed ?? '',
      startChainIndex: context.startChainIndex,
    };

    activityStates.set(context.activityID, state);

    try {
      await loadPendingCheckpoints(context.activityID, state);
    } catch (error) {
      state.invalid = true;

      options.onInvalid(context.activityID, `pending-checkpoint read failed: ${String(error)}`);
    }
  };

  const registerActivity = async (context: Readonly<ActivitySubmissionContext>): Promise<void> => {
    const existing = registrations.get(context.activityID);

    if (existing !== undefined) {
      return existing;
    }

    const registration = createActivityState(context);

    registrations.set(context.activityID, registration);

    await registration;
    await flush(context.activityID);
  };

  const submit = async (
    activityID: string,
    checkpoint: Readonly<ActivityCheckpoint>,
  ): Promise<number | undefined> => {
    const registration = registrations.get(activityID);

    if (registration === undefined) {
      return undefined;
    }

    await registration;

    const state = activityStates.get(activityID);

    invariant(state !== undefined, 'a registered activity has no submission state');

    if (state.invalid) {
      return undefined;
    }

    const entry = buildCheckpointBatchEntry({
      checkpoint,
      entropySource: ENTROPY_SOURCE_SERVER_KEY,
      prevHash: state.prevHash,
      previousNextSeed: state.previousNextSeed,
      startChainIndex: state.startChainIndex,
      version: state.nextVersion,
    });

    await writeQueuedCheckpoint(activityID, entry);

    state.prevHash = entry.hash;
    state.previousNextSeed = entry.payload.nextSeed;
    state.nextVersion += 1;

    const isTerminal =
      checkpoint.type === ActivityCheckpointType.Completed ||
      checkpoint.type === ActivityCheckpointType.Failed;

    if (isTerminal) {
      state.flushScheduled = false;

      await flush(activityID);

      return entry.version;
    }

    if (!state.flushScheduled) {
      state.flushScheduled = true;

      scheduleFlush(async () => {
        if (!state.flushScheduled) {
          return;
        }

        state.flushScheduled = false;

        await flush(activityID);
      });
    }

    return entry.version;
  };

  return { registerActivity, submit };
}

async function loadPendingCheckpoints(
  activityID: string,
  // oxlint-disable-next-line typescript/prefer-readonly-parameter-types -- a mutable cursor this function seeds in place from the durable queue
  state: ActivityState,
): Promise<void> {
  const rows = await readQueuedCheckpoints(activityID);

  const lastRow = rows.at(-1);

  if (lastRow !== undefined) {
    state.nextVersion = lastRow.version + 1;
    state.prevHash = lastRow.hash;
    state.previousNextSeed = lastRow.payload.nextSeed;
  }
}
