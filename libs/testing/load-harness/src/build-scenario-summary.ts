import { buildMaximum } from './build-maximum';
import { buildPercentile } from './build-percentile';
import type {
  CallRecord,
  ContainerSample,
  PipelineSample,
  ProcedureSummary,
  ResourceSummary,
  ScenarioRecording,
  ScenarioSummary,
} from './types';

const MS_PER_HOUR = 3_600_000;

export function buildScenarioSummary(recording: Readonly<ScenarioRecording>): ScenarioSummary {
  const ages = recording.recording.settlementAges.map((age) => age.ageMs);
  const pipeline = recording.recording.pipeline;
  const failedCalls = recording.calls.filter((call) => call.status !== 200);

  return {
    delivery: {
      calls: recording.calls.length,
      failedByStatus: countBy(failedCalls.map((call) => formatCallStatus(call.status))),
      peakBackedOff: buildMaximum(pipeline.map((sample) => sample.backedOff)),
      procedures: collectProcedureSummaries(recording.calls),
      refusals: countBy(
        recording.refusals.map((refusal) => `${refusal.procedure} ${refusal.code}`),
      ),
    },
    events: recording.events,
    exits: recording.exits,
    name: recording.name,
    players: recording.players,
    playMs: recording.playMs,
    reconciliation: recording.reconciliation,
    recoveryMs: buildRecoveryMs(recording),
    resources: collectResourceSummaries(recording.recording.containers),
    settleMs: recording.settleMs,
    settlementAgeMs: {
      count: ages.length,
      max: buildMaximum(ages),
      p50: buildPercentile(ages, 0.5),
      p95: buildPercentile(ages, 0.95),
      p99: buildPercentile(ages, 0.99),
    },
    transactions: {
      byLock: recording.lockWaits.byLock,
      longestTransactionMs: buildMaximum(pipeline.map((sample) => sample.longestTransactionMs)),
      lockWaitMaxMs: buildMaximum(recording.lockWaits.acquiredAfterMs),
      lockWaitP95Ms: buildPercentile(recording.lockWaits.acquiredAfterMs, 0.95),
      lockWaits: recording.lockWaits.waits,
      peakLockWaiters: buildMaximum(pipeline.map((sample) => sample.lockWaiters)),
    },
    workload: {
      activities: recording.reconciliation.activities,
      checkpoints: recording.reconciliation.checkpoints,
      outcomes: recording.reconciliation.outcomes,
      peakVerifiedPerMinute: buildPeakVerifiedRate(pipeline),
      simulatedHours: recording.reconciliation.simulatedMs / MS_PER_HOUR,
    },
  };
}

function countBy(keys: ReadonlyArray<string>): Record<string, number> {
  const counts: Record<string, number> = {};

  for (const key of keys) {
    counts[key] = (counts[key] ?? 0) + 1;
  }

  return counts;
}

// the player client records a call whose fetch threw, such as a refused or reset connection, as
// status 0
function formatCallStatus(status: number): string {
  return status === 0 ? 'no response' : `HTTP ${status}`;
}

function collectProcedureSummaries(calls: ReadonlyArray<CallRecord>): Array<ProcedureSummary> {
  const byProcedure = Map.groupBy(calls, (call) => call.procedure);

  return [...byProcedure]
    .map(([procedure, records]) => {
      const durations = records.map((record) => record.durationMs);

      return {
        calls: records.length,
        failures: records.filter((record) => record.status !== 200).length,
        p50Ms: buildPercentile(durations, 0.5),
        p95Ms: buildPercentile(durations, 0.95),
        procedure,
      };
    })
    .toSorted((left, right) => left.procedure.localeCompare(right.procedure));
}

// the time from a dependency's return until the unproved backlog falls back to what it held in
// steady play before the outage
function buildRecoveryMs(recording: Readonly<ScenarioRecording>): number | undefined {
  const outage = recording.outage;

  if (outage === undefined) {
    return undefined;
  }

  const pipeline = recording.recording.pipeline;

  const before = pipeline
    .filter((sample) => sample.elapsedMs < outage.startedMs)
    .map((sample) => toBacklog(sample));

  const baseline = buildPercentile(before, 0.95);

  const recovered = pipeline.find(
    (sample) => sample.elapsedMs >= outage.endedMs && toBacklog(sample) <= baseline,
  );

  return recovered === undefined ? undefined : recovered.elapsedMs - outage.endedMs;
}

function toBacklog(sample: Readonly<PipelineSample>): number {
  return sample.appended - sample.verified;
}

function collectResourceSummaries(samples: ReadonlyArray<ContainerSample>): Array<ResourceSummary> {
  const byContainer = Map.groupBy(samples, (sample) => sample.container);

  return [...byContainer]
    .map(([container, records]) => ({
      container,
      cpuMeanPercent: records.reduce((sum, record) => sum + record.cpuPercent, 0) / records.length,
      cpuP95Percent: buildPercentile(
        records.map((record) => record.cpuPercent),
        0.95,
      ),
      memoryPeakBytes: buildMaximum(records.map((record) => record.memoryBytes)),
    }))
    .toSorted((left, right) => right.cpuMeanPercent - left.cpuMeanPercent);
}

const RATE_WINDOW_MS = 60_000;

// the largest count a minute-long window of samples moved, so a short burst between two samples
// never reads as a sustained rate
function buildPeakVerifiedRate(samples: ReadonlyArray<PipelineSample>): number {
  let peak = 0;
  let windowStart = 0;

  for (const [index, sample] of samples.entries()) {
    while (
      windowStart < index &&
      sample.elapsedMs - (samples[windowStart + 1]?.elapsedMs ?? sample.elapsedMs) >= RATE_WINDOW_MS
    ) {
      windowStart += 1;
    }

    const first = samples[windowStart];

    if (first !== undefined && sample.elapsedMs - first.elapsedMs >= RATE_WINDOW_MS) {
      peak = Math.max(
        peak,
        ((sample.verified - first.verified) * RATE_WINDOW_MS) /
          (sample.elapsedMs - first.elapsedMs),
      );
    }
  }

  return peak;
}
