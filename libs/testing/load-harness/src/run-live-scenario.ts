import { buildPlayerProfiles } from './build-player-profiles';
import { createConnectedPlayers } from './create-connected-players';
import { createLoadSampler } from './create-load-sampler';
import { parseLockWaits } from './parse-lock-waits';
import { readReconciliation } from './read-reconciliation';
import { runLivePlayer } from './run-live-player';
import type { CallLog, LoadStack, OutageWindow, ScenarioEvent, ScenarioRecording } from './types';
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

  const sampler = createLoadSampler({
    containerPrefix: stack.containerPrefix,
    db: stack.db,
    intervalMs: options.sampleIntervalMs,
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

  const outage =
    options.outage === undefined ? undefined : await runOutage(stack, options.outage, startedAt);

  if (outage !== undefined) {
    events.push(
      { elapsedMs: outage.startedMs, label: `${outage.service} stopped` },
      { elapsedMs: outage.endedMs, label: `${outage.service} started` },
    );
  }

  await Bun.sleep(Math.max(0, options.playMs - (performance.now() - startedAt)));

  controller.abort();

  const playerRuns = await playing;

  const delivered = playerRuns.flat();
  const playMs = performance.now() - startedAt;

  events.push({ elapsedMs: playMs, label: 'play stopped' });

  const settleMs = await waitForSettlement(stack.db, options.settleTimeoutMs);
  const recording = await sampler.stop();
  const postgresLog = await stack.readLogs('postgres', windowStartedAt);

  const expectedXP = new Map(
    delivered.filter((run) => run.terminal).map((run) => [run.activityID, run.xpTotal]),
  );

  return {
    calls: callLog.calls,
    events,
    exits: await stack.readExits(windowStartedAt),
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

async function runOutage(
  stack: Readonly<LoadStack>,
  outage: Outage,
  startedAt: number,
): Promise<OutageWindow> {
  await Bun.sleep(outage.startMs);

  const stoppedAt = performance.now() - startedAt;

  await stack.stopService(outage.service);
  await Bun.sleep(outage.durationMs);
  await stack.startService(outage.service);

  return { endedMs: performance.now() - startedAt, service: outage.service, startedMs: stoppedAt };
}
