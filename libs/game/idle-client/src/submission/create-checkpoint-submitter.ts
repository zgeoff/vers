import type { ActivityCheckpoint } from '@vers/idle-core';
import { ActivityCheckpointType } from '@vers/idle-core';
import invariant from 'tiny-invariant';
import type { ActorOptions, AnyActorLogic } from 'xstate';
import { createActor, waitFor } from 'xstate';
import { buildCheckpointBatchEntry } from './build-checkpoint-batch-entry';
import type { CheckpointActivityChildRef } from './checkpoint-submitter-machine';
import { checkpointSubmitterMachine } from './checkpoint-submitter-machine';
import {
  ENTROPY_SOURCE_SERVER_KEY,
  PROGRESS_FLUSH_INTERVAL_MS,
  RETRY_BACKOFF_CAP_MS,
} from './constants';
import { readQueuedCheckpoints } from './read-queued-checkpoints';
import type { ActivityServiceClient, ActivitySubmissionContext } from './types';
import { writeNodeHead } from './write-node-head';
import { writeQueuedCheckpoint } from './write-queued-checkpoint';

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

  /**
   * Resets every tracked activity's retry backoff, supersedes any running retry loop, and
   * immediately flushes each activity that isn't already stopped — the reconnect recovery path,
   * called once connectivity returns. Each activity's flush settles independently, so one failure
   * never blocks the rest of the drain.
   */
  flushHeld: () => Promise<void>;

  /**
   * Delivers an activity's queued checkpoints now, superseding its shared progress-window timer —
   * the caller is about to stop the activity server-side and would otherwise lose whatever that
   * window still holds unsent. Waits out an attempt already in flight, then makes exactly one
   * flush attempt of its own; a batch the attempt holds for retry resolves as delivered as it's
   * going to get, with no wait on the retry itself. Resolves immediately for an unregistered or
   * invalid activity.
   */
  flushNow: (activityID: string) => Promise<void>;

  /**
   * Reports whether an activity's stream was evicted — a flush answered `SESSION_EVICTED` and
   * discarded its queue — and no registration has superseded the eviction since. A caller that
   * takes the writer back registers the activity again, which clears the marker.
   */
  isEvicted: (activityID: string) => boolean;

  /**
   * Removes an activity's recorded eviction without re-registering it — for a run that has since
   * left `active`, where the displacement is moot and a deferred consumer of the marker must not
   * tell the player the run continues elsewhere.
   */
  removeEviction: (activityID: string) => void;
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
   * Called once an activity's flush has failed `FLUSH_STALL_THRESHOLD` times in a row without a
   * defined contract outcome — a transport failure or an undeclared server error each count, a
   * success or a defined contract error resets the streak. Telemetry only: the stream stays
   * live, its queue intact, and later flushes keep retrying. `traceID` names the failed
   * attempt's trace for log correlation.
   */
  readonly onFlushStalled?: (activityID: string, reason: string, traceID: string) => void;

  /**
   * Called once a `CHECKPOINT_INVALID` response stops an activity's stream, so the caller can
   * notify connected tabs and report the rejection. `traceID` names the rejecting request's
   * trace; a stream stopped by a local failure carries none.
   */
  readonly onInvalid: (activityID: string, reason: string, traceID?: string) => void;

  /**
   * Called once a `SESSION_EVICTED` response stops an activity's stream — another session took
   * over as the activity's writer — after its queue rows are discarded and its state evicted, so
   * the caller can clear the displaced simulation and tell the player. Fired from inside a flush
   * at an arbitrary time relative to lifecycle flows: the caller defers any simulation mutation
   * to a safe point rather than acting inline.
   */
  readonly onEvicted?: (activityID: string) => void;

  /**
   * Called each time a batch is held for retry — a transport failure or `UNAUTHORIZED` — so the
   * caller can report connectivity loss.
   */
  readonly onHeld?: (activityID: string) => void;

  /**
   * Called once a held batch's retry loop dies on an unexpected failure — anything but its own
   * abort — so the caller can report the fault. The batch stays held; a later flush failure
   * starts a fresh loop.
   */
  readonly onRetryFailed?: (activityID: string, error: unknown) => void;

  /**
   * Called each time a flush attempt gets any answer from the activity service — a success or a
   * defined contract outcome alike — proving the connection is up. A stream-ending rejection is
   * often the first response after an outage and may also be the last traffic the activity ever
   * generates, so connectivity recovery cannot wait for a later ack. Fires only once the answer
   * has settled the local queue and cursor, so a recovery it triggers reads settled state.
   */
  readonly onServerContact?: () => void;

  /**
   * Schedules a non-terminal checkpoint's deferred progress-window flush. Defaults to a
   * `PROGRESS_FLUSH_INTERVAL_MS` timer; a test injects a capturing stub to drive the window
   * without waiting on real time, awaiting the returned flush to drain it deterministically.
   */
  readonly scheduleFlush?: (flush: () => Promise<void>) => void;

  /**
   * Overrides the actor clock driving every retry-backoff delay — test-only, so a suite advances
   * a simulated clock explicitly instead of waiting out real backoff windows. Spawned per-activity
   * children inherit it through the actor system.
   */
  readonly clock?: ActorOptions<AnyActorLogic>['clock'];

  /**
   * The runtime's shutdown signal, composed into every held-batch retry loop's own controller so
   * worker teardown ends every activity's loop without an unhandled rejection.
   */
  readonly signal?: AbortSignal;
}

/**
 * One activity's cursor for building the next `CheckpointBatchEntry` to write — the only piece of
 * an activity's submission state this adapter keeps for itself; flush sequencing, backoff, and
 * eviction live in the spawned `checkpointActivityMachine` child this activity's registration
 * spawns. The chain fields advance in place as each accepted submission links onto the last, so
 * they are deliberately not `readonly`. `avatarID` and `scopeID`, when the registration carried
 * them, name the node whose cached head each advance persists back to (`writeNodeHead`).
 */
interface WriteCursor {
  readonly avatarID: string | undefined;
  nextVersion: number;
  prevHash: string;
  previousNextSeed: string;
  readonly scopeID: string | undefined;
  readonly startChainIndex: number;
}

const TERMINAL_CHECKPOINT_TYPES: ReadonlySet<string> = new Set([
  ActivityCheckpointType.Completed,
  ActivityCheckpointType.Failed,
]);

/**
 * Owns a worker's outbound checkpoint submissions: mapping, the durable queue, and one serialized
 * in-flight batch per activity. Each flush rides a freshly minted trace, and a streak of
 * non-defined flush failures reports a stall without stopping the stream. Response handling
 * follows the activity service's response contract:
 *
 * - a fresh head on success or `CONFLICT` advances the cursor and confirms the queue up to it
 * - `CHECKPOINT_INVALID` stops the stream and keeps its queue rows
 * - `NOT_FOUND` stops the stream and discards its queue rows
 * - `ACTIVITY_CAPPED`, `ACTIVITY_TERMINAL`, and `SESSION_EVICTED` stop the stream and discard its
 *   queue rows — the server accepts nothing further for it
 * - anything else — `UNAUTHORIZED` or a transport failure — holds the queue untouched and starts
 *   a per-activity retry loop
 *
 * An activity whose stream stops with its rows discarded has its cursor and registration evicted
 * from both tracking maps, so a later registration re-seeds fresh rather than resolving stale
 * state; a fully confirmed terminal checkpoint evicts the same way once its flush lands.
 * `SESSION_EVICTED` additionally marks the activity as evicted until a later registration
 * supersedes it, so lifecycle flows can tell a displaced stream from one that drained clean.
 * `CHECKPOINT_INVALID` keeps its rows and its tombstoned state for the worker's lifetime, so a
 * later registration attempt never resends what the server already rejected.
 */
export function createCheckpointSubmitter(
  options: Readonly<CreateCheckpointSubmitterOptions>,
): CheckpointSubmitter {
  const writeCursors = new Map<string, WriteCursor>();
  const registrations = new Map<string, Promise<void>>();

  // an options object carrying `clock: undefined` clobbers the actor system's default clock, so
  // the option is only forwarded when a caller actually injected one
  const actorOptions = options.clock === undefined ? undefined : { clock: options.clock };
  const parentActor = createActor(checkpointSubmitterMachine, actorOptions).start();

  const retryTimings = {
    maxTimeout: RETRY_BACKOFF_CAP_MS,
    minTimeout: PROGRESS_FLUSH_INTERVAL_MS,
  };

  const scheduleFlush: (flush: () => Promise<void>) => void =
    options.scheduleFlush ??
    ((flush) => {
      setTimeout(() => {
        void flush();
      }, PROGRESS_FLUSH_INTERVAL_MS);
    });

  const findChild = (activityID: string): CheckpointActivityChildRef | undefined =>
    parentActor.getSnapshot().context.children.get(activityID);

  /**
   * Builds the per-activity closure the child's `scheduled` state calls to arm the shared
   * progress window through `options.scheduleFlush` (or its real-timer default) — a no-op once
   * the activity has already left `scheduled` by the time the window elapses, so a superseded
   * timer never re-sends a batch the queue has moved past.
   */
  const makeScheduleProgressFlush =
    (activityID: string): (() => void) =>
    () => {
      scheduleFlush(async () => {
        const child = findChild(activityID);

        if (child === undefined || !child.getSnapshot().matches('scheduled')) {
          return;
        }

        child.send({ type: 'FLUSH_DUE' });

        await waitFor(child, (snapshot) => !snapshot.matches('flushing'));
      });
    };

  /**
   * Reads an activity's durable queue tail to seed its write cursor and spawns its
   * `checkpointActivityMachine` child, tombstoning through `onInvalid` (no `traceID`, since
   * nothing left this worker) if the read itself fails. The queue read here is the one this
   * worker lifetime shares: every later `registerActivity` call for the activity resolves this
   * same seeding instead of re-reading.
   */
  const createActivityRegistration = async (
    context: Readonly<ActivitySubmissionContext>,
  ): Promise<void> => {
    let rows;

    try {
      rows = await readQueuedCheckpoints(context.activityID);
    } catch (error) {
      options.onInvalid(context.activityID, `pending-checkpoint read failed: ${String(error)}`);

      return;
    }

    const lastRow = rows.at(-1);

    const cursor: WriteCursor = {
      avatarID: context.avatarID,
      nextVersion: context.appendedHead + 1,
      prevHash: context.lastHash,
      previousNextSeed: context.previousNextSeed ?? '',
      scopeID: context.scopeID,
      startChainIndex: context.startChainIndex,
    };

    let terminalQueued = false;
    let latestQueuedVersion: number | undefined;

    if (lastRow !== undefined) {
      cursor.nextVersion = lastRow.version + 1;
      cursor.prevHash = lastRow.hash;
      cursor.previousNextSeed = lastRow.payload.nextSeed;
      terminalQueued = TERMINAL_CHECKPOINT_TYPES.has(lastRow.payload.type);
      latestQueuedVersion = lastRow.version;
    }

    writeCursors.set(context.activityID, cursor);

    parentActor.send({
      activityID: context.activityID,
      client: options.client,
      expectedHead: context.appendedHead,
      latestQueuedVersion,
      onAcked: options.onAcked,
      onCapped: options.onCapped,
      onEvicted: options.onEvicted,
      onInvalid: options.onInvalid,
      onServerContact: options.onServerContact,
      retryTimings,
      scheduleProgressFlush: makeScheduleProgressFlush(context.activityID),
      signal: options.signal,
      terminalQueued,
      type: 'REGISTER',
    });

    const child = findChild(context.activityID);

    invariant(child !== undefined, 'expected the just-spawned child to be reachable by its id');

    // wired before any event can start a flush, so no emission is ever missed
    child.on('flushStalled', (emitted) => {
      options.onFlushStalled?.(emitted.activityID, emitted.reason, emitted.traceID);
    });

    child.on('held', (emitted) => {
      options.onHeld?.(emitted.activityID);
    });

    child.on('retryFailed', (emitted) => {
      options.onRetryFailed?.(emitted.activityID, emitted.error);
    });

    child.subscribe((snapshot) => {
      if (snapshot.status === 'done') {
        writeCursors.delete(context.activityID);
        registrations.delete(context.activityID);
      }
    });
  };

  const flushNow = async (activityID: string): Promise<void> => {
    const child = findChild(activityID);

    if (child === undefined) {
      return;
    }

    child.send({ type: 'FLUSH_NOW' });

    await waitFor(child, (snapshot) => !snapshot.matches('flushing'));
  };

  const registerActivity = async (context: Readonly<ActivitySubmissionContext>): Promise<void> => {
    // a fresh registration supersedes any recorded eviction: the caller re-attaches only after
    // taking the writer back, so the stream is live again for this session
    parentActor.send({ activityID: context.activityID, type: 'REMOVE_EVICTION' });

    const existing = registrations.get(context.activityID);

    if (existing !== undefined) {
      return existing;
    }

    const seeding = createActivityRegistration(context);

    registrations.set(context.activityID, seeding);

    await seeding;
    await flushNow(context.activityID);
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

    // a concurrent flush can drain a terminal checkpoint and evict the activity while this
    // submission awaits its registration — the checkpoint is dropped exactly like one for a
    // never-attached activity
    const cursor = writeCursors.get(activityID);
    const child = findChild(activityID);

    if (cursor === undefined || child === undefined || child.getSnapshot().matches('invalid')) {
      return undefined;
    }

    const entry = buildCheckpointBatchEntry({
      checkpoint,
      entropySource: ENTROPY_SOURCE_SERVER_KEY,
      prevHash: cursor.prevHash,
      previousNextSeed: cursor.previousNextSeed,
      startChainIndex: cursor.startChainIndex,
      version: cursor.nextVersion,
    });

    await writeQueuedCheckpoint(activityID, entry);

    cursor.prevHash = entry.hash;
    cursor.previousNextSeed = entry.payload.nextSeed;
    cursor.nextVersion += 1;

    if (cursor.avatarID !== undefined && cursor.scopeID !== undefined) {
      await writeNodeHead(cursor.avatarID, cursor.scopeID, {
        chainIndex: cursor.startChainIndex + cursor.nextVersion - 1,
        nextSeed: cursor.previousNextSeed,
      });
    }

    const isTerminal = TERMINAL_CHECKPOINT_TYPES.has(checkpoint.type);

    child.send({ isTerminal, type: 'QUEUED', version: entry.version });

    if (isTerminal) {
      await waitFor(child, (snapshot) => !snapshot.matches('flushing'));
    }

    return entry.version;
  };

  const flushHeld = async (): Promise<void> => {
    await Promise.allSettled(
      [...parentActor.getSnapshot().context.children.values()].map((child) => {
        child.send({ type: 'FLUSH_HELD' });

        return waitFor(child, (snapshot) => !snapshot.matches('flushing'));
      }),
    );
  };

  const isEvicted = (activityID: string): boolean =>
    parentActor.getSnapshot().context.evictedActivityIDs.has(activityID);

  const removeEviction = (activityID: string): void => {
    parentActor.send({ activityID, type: 'REMOVE_EVICTION' });
  };

  return { flushHeld, flushNow, isEvicted, registerActivity, removeEviction, submit };
}
