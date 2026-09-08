import type { ActivityData } from '@vers/contract-activity';
import type { QueuedCheckpoint, SubmitterActivityState } from '../submission/types';
import type { DebugEvent, FlushRecord, StartAttemptRecord } from './create-debug-recorder';
import type { WorkerDebugSnapshot } from './debug-snapshot-schema';
import type { LiveRun } from './live-run-schema';
import type { LatestRun } from './types';

interface BuildDebugSnapshotInput {
  readonly capturedAt: number;
  readonly checkpoints: ReadonlyArray<QueuedCheckpoint>;
  readonly connectivityOnline: boolean;
  readonly events: ReadonlyArray<DebugEvent>;
  readonly flushRecords: ReadonlyMap<string, FlushRecord>;
  readonly latestRun: LatestRun | null;
  readonly liveRun: LiveRun | undefined;
  readonly phase: string;
  readonly simulationSpeed: number;
  readonly startAttempts: ReadonlyMap<string, StartAttemptRecord>;
  readonly starts: ReadonlyArray<ActivityData>;
  readonly submitterStates: ReadonlyArray<SubmitterActivityState>;
  readonly writer: WorkerDebugSnapshot['writer'];
}

type PendingCheckpoints = WorkerDebugSnapshot['outbox']['checkpoints'][number];

export function buildDebugSnapshot(input: BuildDebugSnapshotInput): WorkerDebugSnapshot {
  const submitters = new Map(input.submitterStates.map((state) => [state.activityID, state]));

  const findDeferredUntil = (activityID: string): null | number => {
    const submitter = submitters.get(activityID);
    const lastFlush = input.flushRecords.get(activityID);

    if (submitter === undefined || submitter.retryDelayMs === null || lastFlush === undefined) {
      return null;
    }

    return lastFlush.at + submitter.retryDelayMs;
  };

  const liveRun = input.liveRun;
  const latestRun = input.latestRun;

  return {
    capturedAt: input.capturedAt,
    connectivityOnline: input.connectivityOnline,
    events: input.events,
    latestRun:
      latestRun === null
        ? null
        : {
            activityID: latestRun.activityID,
            avatarID: latestRun.avatarID,
            baselineXP: latestRun.baselineXP,
            deltaXP: latestRun.deltaXP,
          },
    liveRun:
      liveRun === undefined
        ? null
        : {
            activityID: liveRun.id,
            appendedHead: submitters.get(liveRun.id)?.expectedHead ?? null,
            avatarID: liveRun.avatarID,
            lastFlush: input.flushRecords.get(liveRun.id) ?? null,
            scopeID: liveRun.scopeID,
            scopeType: liveRun.scopeType,
          },
    outbox: {
      activityStarts: input.starts.map((start) => {
        const attempt = input.startAttempts.get(start.id);

        return {
          activityID: start.id,
          attempts: attempt?.attempts ?? 0,
          avatarID: start.avatarID,
          deferredUntil: findDeferredUntil(start.id),
          lastAttemptAt: attempt?.lastAttemptAt ?? null,
          lastOutcome: attempt?.lastOutcome ?? null,
          lastRefusal: attempt?.lastRefusal ?? null,
          predecessorActivityID: start.predecessorActivityID,
          scopeID: start.scopeID,
        };
      }),
      checkpoints: collectPendingCheckpoints(input.checkpoints).map((pending) => ({
        activityID: pending.activityID,
        count: pending.count,
        deferredUntil: findDeferredUntil(pending.activityID),
        highestVersion: pending.highestVersion,
        lastFlush: input.flushRecords.get(pending.activityID) ?? null,
        submitter: toSubmitterState(submitters.get(pending.activityID)),
      })),
    },
    phase: input.phase,
    simulationSpeed: input.simulationSpeed,
    writer: input.writer,
  };
}

function collectPendingCheckpoints(
  checkpoints: ReadonlyArray<QueuedCheckpoint>,
): ReadonlyArray<Pick<PendingCheckpoints, 'activityID' | 'count' | 'highestVersion'>> {
  const byActivity = new Map<string, { count: number; highestVersion: number }>();

  for (const checkpoint of checkpoints) {
    const current = byActivity.get(checkpoint.activityID);

    byActivity.set(checkpoint.activityID, {
      count: (current?.count ?? 0) + 1,
      highestVersion: Math.max(current?.highestVersion ?? 0, checkpoint.version),
    });
  }

  return [...byActivity.entries()].map(([activityID, summary]) => ({
    activityID,
    count: summary.count,
    highestVersion: summary.highestVersion,
  }));
}

function toSubmitterState(
  state: SubmitterActivityState | undefined,
): PendingCheckpoints['submitter'] {
  if (state === undefined) {
    return null;
  }

  return {
    expectedHead: state.expectedHead,
    latestQueuedVersion: state.latestQueuedVersion,
    retryAttempt: state.retryAttempt,
    retryDelayMs: state.retryDelayMs,
    state: state.state,
  };
}
