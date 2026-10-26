import { buildPlayerProfiles } from './build-player-profiles';
import { collectScenarioExits } from './collect-scenario-exits';
import { createConnectedPlayers } from './create-connected-players';
import { createLoadSampler } from './create-load-sampler';
import { parseLockWaits } from './parse-lock-waits';
import { readReconciliation } from './read-reconciliation';
import { runLivePlayer } from './run-live-player';
import type {
  CallLog,
  ContainerExit,
  LoadStack,
  OutageWindow,
  ScenarioEvent,
  ScenarioRecording,
} from './types';
import { waitForSettlement } from './wait-for-settlement';
import { writePlayerAccounts } from './write-player-accounts';

interface Outage {
  readonly durationMs: number;
  readonly service: string;
  readonly startMs: number;
}

interface RunLiveScenarioOptions {
  readonly flushIntervalMs: number;
  readonly name: string;
  readonly outage?: Outage | undefined;
  readonly players: number;
  readonly playMs: number;
  readonly retainedEvery: number;
  readonly sampleIntervalMs: number;
  readonly settleTimeoutMs: number;
}

// players with the game open for the whole window; with an outage, one dependency stops part way
// through while play goes on, and the window measures how the backlog it leaves drains
export async function runLiveScenario(
  stack: Readonly<LoadStack>,
  options: Readonly<RunLiveScenarioOptions>,
): Promise<ScenarioRecording> {
  const profiles = buildPlayerProfiles({
    count: options.players,
    firstIndex: 0,
    retainedEvery: options.retainedEvery,
    versions: stack.versions,
  });

  const accounts = await writePlayerAccounts(stack.db, profiles, options.name);

  const callLog: CallLog = { calls: [], refusals: [] };

  const connected = await createConnectedPlayers(stack, accounts, callLog);

  const events: Array<ScenarioEvent> = [];

  callLog.calls.length = 0;

  const windowStartedAt = new Date();

  const sampler = await createLoadSampler({
    containerPrefix: stack.containerPrefix,
    db: stack.db,
    intervalMs: options.sampleIntervalMs,
    readContainerStats: stack.readContainerStats,
  });

  const startedAt = performance.now();

  const controller = new AbortController();

  const playing = Promise.all(
    connected.map((player) =>
      runLivePlayer({
        avatarID: player.account.avatarID,
        buildSnapshot: player.buildSnapshot,
        chain: player.chain,
        client: player.client,
        content: player.content,
        flushIntervalMs: options.flushIntervalMs,
        onRefused: (procedure, code) => {
          callLog.refusals.push({ code, procedure });
        },
        profile: player.account.profile,
        signal: controller.signal,
      }),
    ),
  );

  const outageRun =
    options.outage === undefined
      ? undefined
      : await runOutage(stack, options.outage, { startedAt, windowStartedAt });

  const outage = outageRun?.window;

  if (outage !== undefined) {
    events.push(
      { elapsedMs: outage.startedMs, label: `${outage.service} stopped` },
      { elapsedMs: outage.endedMs, label: `${outage.service} started` },
    );
  }

  await Bun.sleep(Math.max(0, options.playMs - (performance.now() - startedAt)));

  controller.abort();

  const stoppedAt = performance.now();
  const playMs = stoppedAt - startedAt;

  events.push({ elapsedMs: playMs, label: 'play stopped' });

  const playerRuns = await playing;

  const delivered = playerRuns.flat();

  events.push({ elapsedMs: performance.now() - startedAt, label: 'final flush delivered' });

  const settleMs = await waitForSettlement(stack.db, options.settleTimeoutMs, stoppedAt);
  const recording = await sampler.stop();
  const postgresLog = await stack.readLogs('postgres', windowStartedAt);
  const finalExits = await stack.readExits(windowStartedAt);

  const expectedXP = new Map(
    delivered.filter((run) => run.terminal).map((run) => [run.activityID, run.xpTotal]),
  );

  return {
    calls: callLog.calls,
    events,
    cpuLimits: await stack.readCPULimits(),
    exits: collectScenarioExits(
      finalExits,
      outageRun?.exitsBeforeRestart ?? [],
      outageRun?.requestedStop,
    ),
    lockWaits: parseLockWaits(postgresLog),
    name: options.name,
    outage,
    players: options.players,
    playMs,
    reconciliation: await readReconciliation(stack.db, accounts, expectedXP),
    recording,
    refusals: callLog.refusals,
    settleMs,
  };
}

interface OutageClock {
  readonly startedAt: number;
  readonly windowStartedAt: Date;
}

interface OutageRun {
  readonly exitsBeforeRestart: Array<ContainerExit>;
  readonly requestedStop: { readonly container: string; readonly elapsedMs: number };
  readonly window: OutageWindow;
}

// reads the exits before the restart, because the restart would hide a container that crashed
// during the outage from the scenario's final inspection
async function runOutage(
  stack: Readonly<LoadStack>,
  outage: Outage,
  clock: OutageClock,
): Promise<OutageRun> {
  await Bun.sleep(outage.startMs);

  const stoppedAt = performance.now() - clock.startedAt;
  const stopElapsedMs = Date.now() - clock.windowStartedAt.getTime();

  await stack.stopService(outage.service);
  await Bun.sleep(outage.durationMs);

  const exitsBeforeRestart = await stack.readExits(clock.windowStartedAt);

  await stack.startService(outage.service);

  return {
    exitsBeforeRestart,
    requestedStop: {
      container: `${stack.containerPrefix}${outage.service}-1`,
      elapsedMs: stopElapsedMs,
    },
    window: {
      endedMs: performance.now() - clock.startedAt,
      service: outage.service,
      startedMs: stoppedAt,
    },
  };
}
