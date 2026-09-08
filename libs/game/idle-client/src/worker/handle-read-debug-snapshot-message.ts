import { readAllActivityStarts } from '../submission/read-all-activity-starts';
import { readAllQueuedCheckpoints } from '../submission/read-all-queued-checkpoints';
import { buildDebugSnapshot } from './build-debug-snapshot';
import type { WorkerDebugSnapshot } from './debug-snapshot-schema';
import { findLiveRun } from './find-live-run';
import type { WorkerContext } from './types';

export async function handleReadDebugSnapshotMessage(
  context: WorkerContext,
): Promise<WorkerDebugSnapshot> {
  const [starts, checkpoints] = await Promise.all([
    readAllActivityStarts(),
    readAllQueuedCheckpoints(),
  ]);

  const debug = context.getDebugRecorder();

  return buildDebugSnapshot({
    capturedAt: Date.now(),
    checkpoints,
    connectivityOnline: context.getConnectivityOnline(),
    events: debug.getEvents(),
    flushRecords: debug.getFlushRecords(),
    latestRun: context.getLatestRun(),
    liveRun: findLiveRun(context),
    phase: context.getLifecycle().getSnapshot().context.phase,
    startAttempts: debug.getStartAttempts(),
    starts,
    submitterStates: context.getSubmitter().collectActivityStates(),
    writer: { bootedAt: debug.bootedAt, workerID: debug.workerID },
  });
}
