import path from 'node:path';
import { loadEngineHash } from '@vers/scripts';
import { $ } from 'bun';
import { match } from 'ts-pattern';
import { buildLoadImageRefs } from './build-load-image-refs';
import { buildScenarioSummary } from './build-scenario-summary';
import { LOAD_POSTGRES_CPUS, createLoadStack } from './create-load-stack';
import { renderLoadReport } from './render-load-report';
import { runLiveScenario } from './run-live-scenario';
import { runLoadImages } from './run-load-images';
import { runOfflineReturnScenario } from './run-offline-return-scenario';
import type { LoadStack, ScenarioRecording, ScenarioSummary } from './types';

export interface RunLoadOptions {
  readonly cpuProfile: 'baseline' | 'burst';
  readonly log: (line: string) => void;
  readonly offlineHours: number;
  readonly offlinePlayers: number;
  readonly outageMinutes: number;
  readonly outageService: string;
  readonly outDir: string;
  readonly recoveryPlayers: number;
  readonly retainedEvery: number;
  readonly scenario: 'all' | 'offline-return' | 'recovery' | 'steady';
  readonly settlementTargetSeconds: number;
  readonly skipBuild: boolean;
  readonly steadyMinutes: number;
  readonly steadyPlayers: ReadonlyArray<number>;
}

// a shared Fly CPU's sustained quota is a sixteenth of a core, and its burst runs a whole core
const SHARED_CPU_BASELINE = 1 / 16;

// each scenario gets a fresh stack, so one scenario's backlog or tables never weigh on the next
export async function runLoad(options: Readonly<RunLoadOptions>): Promise<string> {
  const head = await $`git rev-parse --short HEAD`.quiet().text();

  const commit = head.trim();

  const current = await loadEngineHash();

  const versions = { current, retained: `${current}-retained` };
  const serviceCPUs = options.cpuProfile === 'burst' ? 1 : SHARED_CPU_BASELINE;

  if (!options.skipBuild) {
    options.log(`building the stack images for ${commit}`);

    await runLoadImages(versions, commit);
  }

  const summaries: Array<ScenarioSummary> = [];

  for (const [name, run] of planScenarioRuns(options)) {
    options.log(`${name}: booting a fresh stack`);

    const stack = await createLoadStack({
      imageRefs: buildLoadImageRefs(commit),
      serviceCPUs,
      versions,
    });

    try {
      options.log(`${name}: running`);

      const recording = await run(stack);

      await Bun.write(path.join(options.outDir, `${name}.json`), JSON.stringify(recording));

      summaries.push(buildScenarioSummary(recording));

      const settled =
        recording.settleMs === undefined
          ? 'never settled'
          : `settled in ${(recording.settleMs / 1000).toFixed(1)} s`;

      options.log(`${name}: done, ${settled}`);
    } finally {
      await stack.remove();
    }
  }

  const reportPath = path.join(options.outDir, 'report.md');

  await Bun.write(
    reportPath,
    renderLoadReport(
      {
        commit,
        postgresCPUs: LOAD_POSTGRES_CPUS,
        serviceCPUs,
        settlementTargetMs: options.settlementTargetSeconds * 1000,
        versions,
      },
      summaries,
    ),
  );

  return reportPath;
}

type ScenarioRun = (stack: Readonly<LoadStack>) => Promise<ScenarioRecording>;

const FLUSH_INTERVAL_MS = 10_000;
const SAMPLE_INTERVAL_MS = 1000;
const MS_PER_MINUTE = 60_000;
const SETTLE_TIMEOUT_MS = 30 * MS_PER_MINUTE;
const RECOVERY_WARM_MS = 2 * MS_PER_MINUTE;
const RECOVERY_TAIL_MS = 5 * MS_PER_MINUTE;

function planScenarioRuns(options: Readonly<RunLoadOptions>): Array<[string, ScenarioRun]> {
  const steady = options.steadyPlayers.map((players): [string, ScenarioRun] => [
    `steady-${players}`,
    (stack) =>
      runLiveScenario(stack, {
        flushIntervalMs: FLUSH_INTERVAL_MS,
        name: `steady-${players}`,
        players,
        playMs: options.steadyMinutes * MS_PER_MINUTE,
        retainedEvery: options.retainedEvery,
        sampleIntervalMs: SAMPLE_INTERVAL_MS,
        settleTimeoutMs: SETTLE_TIMEOUT_MS,
      }),
  ]);

  const offline: [string, ScenarioRun] = [
    'offline-return',
    (stack) =>
      runOfflineReturnScenario(stack, {
        name: 'offline-return',
        offlineMs: options.offlineHours * 60 * MS_PER_MINUTE,
        players: options.offlinePlayers,
        retainedEvery: options.retainedEvery,
        sampleIntervalMs: SAMPLE_INTERVAL_MS,
        settleTimeoutMs: SETTLE_TIMEOUT_MS,
      }),
  ];

  const recovery: [string, ScenarioRun] = [
    'recovery',
    (stack) =>
      runLiveScenario(stack, {
        flushIntervalMs: FLUSH_INTERVAL_MS,
        name: 'recovery',
        outage: {
          durationMs: options.outageMinutes * MS_PER_MINUTE,
          service: options.outageService,
          startMs: RECOVERY_WARM_MS,
        },
        players: options.recoveryPlayers,
        playMs: RECOVERY_WARM_MS + options.outageMinutes * MS_PER_MINUTE + RECOVERY_TAIL_MS,
        retainedEvery: options.retainedEvery,
        sampleIntervalMs: SAMPLE_INTERVAL_MS,
        settleTimeoutMs: SETTLE_TIMEOUT_MS,
      }),
  ];

  return match(options.scenario)
    .with('all', () => [...steady, offline, recovery])
    .with('steady', () => steady)
    .with('offline-return', () => [offline])
    .with('recovery', () => [recovery])
    .exhaustive();
}
