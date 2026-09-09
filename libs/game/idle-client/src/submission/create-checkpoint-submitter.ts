import type { ActivityCheckpoint } from '@vers/idle-core';
import { ActivityCheckpointType } from '@vers/idle-core';
import invariant from 'tiny-invariant';
import type { ActorOptions, ActorRefFromLogic, AnyActorLogic } from 'xstate';
import { createActor, waitFor } from 'xstate';
import { buildCheckpointBatchEntry } from './build-checkpoint-batch-entry';
import { buildRetryBackoffMS } from './build-retry-backoff-ms';
import type { CheckpointActivityChildRef } from './checkpoint-submitter-machine';
import { checkpointSubmitterMachine } from './checkpoint-submitter-machine';
import {
  ENTROPY_SOURCE_SERVER_KEY,
  PROGRESS_FLUSH_INTERVAL_MS,
  RETRY_BACKOFF_CAP_MS,
} from './constants';
import type { IngestActivityStartOutcome } from './ingest-activity-start';
import { JournalWriteError } from './journal-write-error';
import { readQueuedCheckpoints } from './read-queued-checkpoints';
import type { FlushOutcome } from './run-checkpoint-flush-attempt';
import type {
  ActivityServiceClient,
  ActivitySubmissionContext,
  SubmitterActivityState,
} from './types';
import { writeNodeAnchor } from './write-node-anchor';
import { writeQueuedCheckpoint } from './write-queued-checkpoint';

export interface CheckpointSubmitter {
  collectActivityStates: () => ReadonlyArray<SubmitterActivityState>;

  registerActivity: (context: Readonly<ActivitySubmissionContext>) => Promise<void>;

  submit: (
    activityID: string,
    checkpoint: Readonly<ActivityCheckpoint>,
  ) => Promise<number | undefined>;

  flushHeld: () => Promise<void>;

  flushNow: (activityID: string) => Promise<void>;

  isEvicted: (activityID: string) => boolean;

  removeEviction: (activityID: string) => void;
}

interface CreateCheckpointSubmitterOptions {
  readonly actor?: ActorRefFromLogic<typeof checkpointSubmitterMachine>;

  readonly client: Pick<ActivityServiceClient, 'trackActivityProgress'>;

  readonly ingestActivityStart?: (activityID: string) => Promise<IngestActivityStartOutcome>;

  readonly journal?: CheckpointJournal;

  readonly onAcked?: (activityID: string, appendedHead: number) => void;

  readonly onCapped?: (activityID: string, appendedHead: number) => void;

  readonly onFlushStalled?: (activityID: string, reason: string, traceID: string) => void;

  readonly onInvalid: (activityID: string, reason: string, traceID?: string) => void;

  readonly onEvicted?: (activityID: string) => void;

  readonly onJournalFailure?: (failure: Readonly<JournalWriteError>) => void;

  readonly onJournalUnreadable?: (
    activityID: string,
    receivedVersion: number,
    error: unknown,
  ) => void;

  readonly onSaved?: (activityID: string, version: number) => void;

  readonly onFlushSettled?: (activityID: string, outcome: Readonly<FlushOutcome>) => void;

  readonly onHeld?: (activityID: string) => void;

  readonly onRetryFailed?: (activityID: string, error: unknown) => void;

  readonly onServerContact?: () => void;

  readonly scheduleFlush?: (flush: () => Promise<void>) => void;

  readonly clock?: ActorOptions<AnyActorLogic>['clock'];

  readonly signal?: AbortSignal;
}

// the two journal calls the outbox depends on, injectable so a test can make the browser's storage
// refuse a write, which fake-indexeddb never does on its own
interface CheckpointJournal {
  readonly readQueuedCheckpoints: typeof readQueuedCheckpoints;
  readonly writeQueuedCheckpoint: typeof writeQueuedCheckpoint;
}

const REAL_JOURNAL: CheckpointJournal = { readQueuedCheckpoints, writeQueuedCheckpoint };

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

export function createCheckpointSubmitter(
  options: Readonly<CreateCheckpointSubmitterOptions>,
): CheckpointSubmitter {
  const writeCursors = new Map<string, WriteCursor>();
  const registrations = new Map<string, Promise<void>>();

  const journal = options.journal ?? REAL_JOURNAL;

  // an options object carrying `clock: undefined` clobbers the actor system's default clock, so
  // the option is only forwarded when a caller actually injected one
  const actorOptions = options.clock === undefined ? undefined : { clock: options.clock };

  const parentActor =
    options.actor ?? createActor(checkpointSubmitterMachine, actorOptions).start();

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

  const createActivityRegistration = async (
    context: Readonly<ActivitySubmissionContext>,
  ): Promise<void> => {
    let rows;

    try {
      rows = await journal.readQueuedCheckpoints(context.activityID);
    } catch (error) {
      // a reporting observer never replaces the invalidation that keeps the stream from resuming
      try {
        options.onJournalUnreadable?.(context.activityID, context.appendedHead, error);
      } catch {
        // contained: see above
      }

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
      options.onSaved?.(context.activityID, lastRow.version);
    }

    writeCursors.set(context.activityID, cursor);

    parentActor.send({
      activityID: context.activityID,
      client: options.client,
      expectedHead: context.appendedHead,
      ingestActivityStart: options.ingestActivityStart,
      latestQueuedVersion,
      onAcked: options.onAcked,
      onCapped: options.onCapped,
      onEvicted: options.onEvicted,
      onFlushSettled: options.onFlushSettled,
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

    // a checkpoint the journal refused is not in the outbox, so the cursor stays where it was and
    // the failure propagates to the tick loop, which stops rather than simulate past an unsaved step
    try {
      await journal.writeQueuedCheckpoint(activityID, entry);
    } catch (error) {
      const failure = new JournalWriteError(
        activityID,
        child.getSnapshot().context.expectedHead,
        error,
      );

      // a reporting observer never replaces the classified failure the tick loop stops on
      try {
        options.onJournalFailure?.(failure);
      } catch {
        // contained: see above
      }

      throw failure;
    }

    cursor.prevHash = entry.hash;
    cursor.previousNextSeed = entry.payload.nextSeed;
    cursor.nextVersion += 1;
    options.onSaved?.(activityID, entry.version);

    if (cursor.avatarID !== undefined && cursor.scopeID !== undefined) {
      await writeNodeAnchor(cursor.avatarID, cursor.scopeID, {
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

  const collectActivityStates = (): ReadonlyArray<SubmitterActivityState> =>
    [...parentActor.getSnapshot().context.children.entries()].map(([activityID, child]) => {
      const snapshot = child.getSnapshot();
      const state = snapshot.value;

      return {
        activityID,
        expectedHead: snapshot.context.expectedHead,
        latestQueuedVersion: snapshot.context.latestQueuedVersion ?? null,
        retryAttempt: snapshot.context.retryAttempt,
        retryDelayMs:
          state === 'retrying'
            ? buildRetryBackoffMS(snapshot.context.retryTimings, snapshot.context.retryAttempt)
            : null,
        state,
      };
    });

  const removeEviction = (activityID: string): void => {
    parentActor.send({ activityID, type: 'REMOVE_EVICTION' });
  };

  return {
    collectActivityStates,
    flushHeld,
    flushNow,
    isEvicted,
    registerActivity,
    removeEviction,
    submit,
  };
}
