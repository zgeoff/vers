import { isDefinedError, safe } from '@orpc/client';
import { createId } from '@paralleldrive/cuid2';
import type { BuildSnapshot } from '@vers/contract-activity';
import type { EncounterContent } from '@vers/game-utils';
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

// a player with the game open: the writer worker's live loop, flushing what the simulation has
// reached on the client's flush interval and minting a continuation at each terminal checkpoint
export async function runLivePlayer(
  options: Readonly<RunLivePlayerOptions>,
): Promise<Array<DeliveredRun>> {
  const delivered: Array<DeliveredRun> = [];

  let cursor = await startRun(options, options.chain, options.buildSnapshot, null);

  while (cursor !== undefined && !options.signal.aborted) {
    await Bun.sleep(options.flushIntervalMs);

    const flushed = await flushDue(options, cursor, performance.now() - cursor.startedAt);

    if (!flushed) {
      return delivered;
    }

    if (cursor.sent === cursor.run.entries.length) {
      delivered.push({ activityID: cursor.run.id, terminal: true, xpTotal: cursor.run.xpTotal });

      cursor = await startRun(
        options,
        { ...options.chain, anchor: cursor.run.nextAnchor },
        cursor.run.nextBuildSnapshot,
        cursor.run.id,
      );
    }
  }

  if (cursor !== undefined) {
    await stopRun(options, cursor);

    delivered.push({ activityID: cursor.run.id, terminal: false, xpTotal: 0 });
  }

  return delivered;
}

interface LiveCursor {
  readonly run: ActivityRun;
  sent: number;
  readonly startedAt: number;
}

async function startRun(
  options: Readonly<RunLivePlayerOptions>,
  chain: PlayerChain,
  buildSnapshot: BuildSnapshot,
  predecessorActivityID: null | string,
): Promise<LiveCursor | undefined> {
  const run = await runActivityAttempt({
    activityID: `act_${createId()}`,
    avatarID: options.avatarID,
    buildSnapshot,
    chain,
    content: options.content,
    playedAt: new Date(),
    predecessorActivityID,
    simVersion: options.profile.simVersion,
  });

  for (;;) {
    const [error] = await safe(
      options.client.advanceActivity({
        activityID: run.id,
        activityStart: run.start,
        continuations: [],
        expectedHead: 0,
      }),
    );

    if (error === null) {
      return { run, sent: 0, startedAt: performance.now() };
    }

    if (isDefinedError(error)) {
      options.onRefused('advanceActivity', error.code);

      return undefined;
    }

    if (options.signal.aborted) {
      return undefined;
    }

    await Bun.sleep(options.flushIntervalMs);
  }
}

async function flushDue(
  options: Readonly<RunLivePlayerOptions>,
  cursor: LiveCursor,
  elapsedMs: number,
): Promise<boolean> {
  const due = pickDueEntries(cursor.run.entries, cursor.sent, elapsedMs);

  if (due.length === 0) {
    return true;
  }

  const [error] = await safe(
    options.client.trackActivityProgress({
      activityID: cursor.run.id,
      checkpoints: due,
      expectedHead: cursor.sent,
    }),
  );

  if (error === null) {
    cursor.sent += due.length;

    return true;
  }

  if (isDefinedError(error)) {
    options.onRefused('trackActivityProgress', error.code);

    return false;
  }

  // an undefined error already spent the client's retries; the outbox keeps the batch for the
  // next flush, as the worker's does
  return true;
}

async function stopRun(options: Readonly<RunLivePlayerOptions>, cursor: LiveCursor): Promise<void> {
  await flushDue(options, cursor, performance.now() - cursor.startedAt);

  const [error] = await safe(
    options.client.stopActivity({ activityID: cursor.run.id, avatarID: options.avatarID }),
  );

  if (error !== null) {
    const code = isDefinedError(error) ? error.code : 'UNDELIVERED';

    options.onRefused('stopActivity', code);
  }
}
