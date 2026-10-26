import { isDefinedError, safe } from '@orpc/client';
import { createId } from '@paralleldrive/cuid2';
import type { BuildSnapshot } from '@vers/contract-activity';
import type { EncounterContent } from '@vers/game-utils';
import invariant from 'tiny-invariant';
import { pickDueEntries } from './pick-due-entries';
import { runActivityAttempt } from './run-activity-attempt';
import type { ActivityRun, DeliveredRun, PlayerChain, PlayerClient, PlayerProfile } from './types';

interface RunLivePlayerOptions {
  readonly avatarID: string;
  readonly buildSnapshot: BuildSnapshot;
  readonly chain: PlayerChain;
  readonly client: PlayerClient;
  readonly content: EncounterContent;
  readonly flushIntervalMs: number;
  readonly onRefused: (procedure: string, code: string) => void;
  readonly profile: PlayerProfile;
  readonly signal: AbortSignal;
}

interface OutboxRun {
  admitted: boolean;
  readonly offsetMs: number;
  readonly run: ActivityRun;
  sent: number;
}

// a player with the game open: the writer worker simulates on its own clock and mints each
// continuation at the terminal checkpoint before it, while the outbox delivers what the
// simulation has reached, in order, on the client's flush interval and whatever the server answers
export async function runLivePlayer(
  options: Readonly<RunLivePlayerOptions>,
): Promise<Array<DeliveredRun>> {
  const playStartedAt = performance.now();

  const first = await mintRun(options, undefined, 0);

  const outbox: Array<OutboxRun> = [first];

  while (!options.signal.aborted) {
    await Bun.sleep(options.flushIntervalMs);

    const elapsedMs = performance.now() - playStartedAt;

    await mintReachedRuns(options, outbox, elapsedMs);

    const outcome = await flushOutbox(options, outbox, elapsedMs);

    if (outcome === 'refused') {
      return collectDelivered(outbox);
    }
  }

  const stoppedMs = performance.now() - playStartedAt;

  await mintReachedRuns(options, outbox, stoppedMs);
  await flushOutbox(options, outbox, stoppedMs);
  await stopOpenRun(options, outbox);

  return collectDelivered(outbox);
}

async function mintRun(
  options: Readonly<RunLivePlayerOptions>,
  previous: Readonly<OutboxRun> | undefined,
  offsetMs: number,
): Promise<OutboxRun> {
  const run = await runActivityAttempt({
    activityID: `act_${createId()}`,
    avatarID: options.avatarID,
    buildSnapshot: previous?.run.nextBuildSnapshot ?? options.buildSnapshot,
    chain:
      previous === undefined
        ? options.chain
        : { ...options.chain, anchor: previous.run.nextAnchor },
    content: options.content,
    playedAt: new Date(),
    predecessorActivityID: previous?.run.id ?? null,
    simVersion: options.profile.simVersion,
  });

  return { admitted: false, offsetMs, run, sent: 0 };
}

// an attempt ends at its last checkpoint's time, and the worker starts the next one there
async function mintReachedRuns(
  options: Readonly<RunLivePlayerOptions>,
  outbox: Array<OutboxRun>,
  elapsedMs: number,
): Promise<void> {
  for (;;) {
    const last = outbox.at(-1);

    invariant(last !== undefined, 'the outbox always holds the first run');

    const endMs = last.offsetMs + getAttemptDurationMs(last.run);

    if (endMs > elapsedMs) {
      return;
    }

    const next = await mintRun(options, last, endMs);

    outbox.push(next);
  }
}

function getAttemptDurationMs(run: Readonly<ActivityRun>): number {
  const durationMs = run.entries.at(-1)?.payload.time;

  invariant(durationMs !== undefined && durationMs > 0, 'a terminal attempt takes simulated time');

  return durationMs;
}

type FlushOutcome = 'held' | 'refused' | 'sent';

// a call that fails after the client's retries leaves the outbox as it was for the next flush, as
// the worker's does; a refusal is a verdict, and the player stops
async function flushOutbox(
  options: Readonly<RunLivePlayerOptions>,
  outbox: ReadonlyArray<OutboxRun>,
  elapsedMs: number,
): Promise<FlushOutcome> {
  for (const entry of outbox) {
    const outcome = await flushRun(options, entry, elapsedMs - entry.offsetMs);

    if (outcome !== 'sent' || entry.sent < entry.run.entries.length) {
      return outcome;
    }
  }

  return 'sent';
}

async function flushRun(
  options: Readonly<RunLivePlayerOptions>,
  entry: OutboxRun,
  attemptElapsedMs: number,
): Promise<FlushOutcome> {
  if (!entry.admitted) {
    const [error] = await safe(
      options.client.advanceActivity({
        activityID: entry.run.id,
        activityStart: entry.run.start,
        continuations: [],
        expectedHead: 0,
      }),
    );

    if (error !== null) {
      return isDefinedError(error) ? refuse(options, 'advanceActivity', error.code) : 'held';
    }

    entry.admitted = true;
  }

  for (;;) {
    const due = pickDueEntries(entry.run.entries, entry.sent, attemptElapsedMs);

    if (due.length === 0) {
      return 'sent';
    }

    const [error] = await safe(
      options.client.trackActivityProgress({
        activityID: entry.run.id,
        checkpoints: due,
        expectedHead: entry.sent,
      }),
    );

    if (error !== null) {
      return isDefinedError(error) ? refuse(options, 'trackActivityProgress', error.code) : 'held';
    }

    entry.sent += due.length;
  }
}

function refuse(
  options: Readonly<RunLivePlayerOptions>,
  procedure: string,
  code: string,
): FlushOutcome {
  options.onRefused(procedure, code);

  return 'refused';
}

function collectDelivered(outbox: ReadonlyArray<OutboxRun>): Array<DeliveredRun> {
  return outbox
    .filter((entry) => entry.admitted)
    .map((entry) => {
      const terminal = entry.sent === entry.run.entries.length;

      return { activityID: entry.run.id, terminal, xpTotal: terminal ? entry.run.xpTotal : 0 };
    });
}

// a run the server admitted but whose terminal checkpoint it never received is the one the player
// stops when it closes the game
async function stopOpenRun(
  options: Readonly<RunLivePlayerOptions>,
  outbox: ReadonlyArray<OutboxRun>,
): Promise<void> {
  const open = outbox.find((entry) => entry.admitted && entry.sent < entry.run.entries.length);

  if (open === undefined) {
    return;
  }

  const [error] = await safe(
    options.client.stopActivity({ activityID: open.run.id, avatarID: options.avatarID }),
  );

  if (error !== null) {
    const code = isDefinedError(error) ? error.code : 'UNDELIVERED';

    options.onRefused('stopActivity', code);
  }
}
