import { isExpectedVersionConflictError } from '@event-driven-io/emmett';
import type { ActivityStore, Checkpoint } from '@vers/spike-store';
import { buildStats, type LatencyStats } from './build-stats';
import { withTiming } from './with-timing';

export type BenchScenarioInput = {
  batches: number;
  checkpointsPerBatch: number;
  pointReads: number;
};

export type BenchScenarioReport = {
  activityId: string;
  createStreamMs: number;
  append: LatencyStats;
  pointRead: LatencyStats;
  replayMs: number;
  replayEventCount: number;
  chainValid: boolean;
  finalProgress: number | null;
  conflictDetected: boolean;
  conflictError: string | null;
};

/**
 * The full exercise against one fresh activity stream: create, append
 * `batches` checkpoint batches (each hash-chained to the last), point-read the
 * inline projection `pointReads` times, replay the stream through the chain
 * verifier, then confirm a stale expected version is rejected.
 */
export async function runBenchScenario(
  store: ActivityStore,
  input: BenchScenarioInput,
): Promise<BenchScenarioReport> {
  const activityId = crypto.randomUUID();

  const created = await withTiming(() =>
    store.createActivityStream({ activityId, seed: `seed-${activityId}`, difficulty: 3 }),
  );
  let prevHash = created.result.genesisHash;
  let version = created.result.nextExpectedStreamVersion;

  const appendSamples: number[] = [];
  let progress = 0;
  for (let batch = 0; batch < input.batches; batch++) {
    const checkpoints: Checkpoint[] = Array.from({ length: input.checkpointsPerBatch }, (_, index) => ({
      tick: batch * input.checkpointsPerBatch + index,
      progress: Math.min(1, (batch * input.checkpointsPerBatch + index + 1) / (input.batches * input.checkpointsPerBatch)),
      statsDelta: { xp: 10, kills: 1 },
    }));
    progress = checkpoints[checkpoints.length - 1]?.progress ?? progress;
    const appended = await withTiming(() =>
      store.appendCheckpointBatch({ activityId, checkpoints, progress, prevHash, expectedStreamVersion: version }),
    );
    prevHash = appended.result.hash;
    version = appended.result.nextExpectedStreamVersion;
    appendSamples.push(appended.ms);
  }

  const pointReadSamples: number[] = [];
  let latestProgress: number | null = null;
  for (let read = 0; read < input.pointReads; read++) {
    const found = await withTiming(() => store.readProgress(activityId));
    latestProgress = found.result?.progress ?? null;
    pointReadSamples.push(found.ms);
  }

  const replayed = await withTiming(() => store.replayActivity(activityId));

  let conflictDetected = false;
  let conflictError: string | null = null;
  try {
    await store.appendCheckpointBatch({
      activityId,
      checkpoints: [{ tick: 0, progress: 0, statsDelta: { xp: 1 } }],
      progress,
      prevHash,
      expectedStreamVersion: 1n,
    });
    conflictError = 'append with stale version unexpectedly succeeded';
  } catch (error) {
    conflictDetected = isExpectedVersionConflictError(error);
    if (!conflictDetected) conflictError = `${(error as Error).constructor.name}: ${(error as Error).message}`;
  }

  return {
    activityId,
    createStreamMs: Math.round(created.ms * 10) / 10,
    append: buildStats(appendSamples),
    pointRead: buildStats(pointReadSamples),
    replayMs: Math.round(replayed.ms * 10) / 10,
    replayEventCount: replayed.result.eventCount,
    chainValid: replayed.result.chain.valid,
    finalProgress: latestProgress,
    conflictDetected,
    conflictError,
  };
}
