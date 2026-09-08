import type { ActivityData } from '@vers/contract-activity';
import type { LatestActivityProgress } from '../resync/types';
import { readAllActivityStarts } from '../submission/read-all-activity-starts';
import { readLastStartedActivity } from '../submission/read-last-started-activity';
import { removeActivityStart } from '../submission/remove-activity-start';
import { removeLastStartedActivity } from '../submission/remove-last-started-activity';
import { removeQueuedCheckpoints } from '../submission/remove-queued-checkpoints';
import { writeLastStartedActivity } from '../submission/write-last-started-activity';
import { WorkerMessageType } from '../types';
import { handleSimulationUpdate } from './handle-simulation-update';
import { resetSimulation } from './reset-simulation';
import { RunOutcomeKind } from './run-outcome-schema';
import type { WorkerContext } from './types';

interface RejectActivityStartInput {
  readonly latest: LatestActivityProgress | null;
  readonly row: ActivityData;
}

export async function rejectActivityStart(
  context: WorkerContext,
  input: Readonly<RejectActivityStartInput>,
): Promise<void> {
  const row = input.row;

  // an in-flight start or continuation would chain its row on the refused one and fold from the
  // same wrong snapshot; aborting it before the snapshot below keeps the drop complete
  context.advanceStopScope();

  const pending = await readAllActivityStarts();

  const dropped = collectChainedStartIDs(
    pending.filter((candidate) => candidate.avatarID === row.avatarID),
    row.id,
  );

  for (const activityID of dropped) {
    if (activityID !== row.id) {
      await removeActivityStart(activityID);
      await removeQueuedCheckpoints(activityID);
    }
  }

  const held = context.getActivity();
  const heldDropped = held !== null && dropped.has(held.id);

  if (heldDropped) {
    context.getSimulation().stopActivity();

    resetSimulation(context);

    context.resetRewardSlotLedger();

    handleSimulationUpdate(context);
  }

  await resetLatestRunRecords(context, row.avatarID, dropped, input.latest);

  // the root goes last: a drop that fails before this point leaves it in the store, and the next
  // reconnect re-ingests it, is refused again, and repeats the whole drop
  await removeActivityStart(row.id);
  await removeQueuedCheckpoints(row.id);

  const ended = heldDropped ? held : row;

  context.broadcast({
    outcome: {
      activityID: ended.id,
      avatarID: ended.avatarID,
      kind: RunOutcomeKind.Refused,
      scope: { scopeID: ended.scopeID, scopeType: ended.scopeType },
      xp: 0,
    },
    type: WorkerMessageType.ActivityEnded,
  });
}

function collectChainedStartIDs(
  rows: ReadonlyArray<ActivityData>,
  rootID: string,
): ReadonlySet<string> {
  const collected = new Set([rootID]);

  let grew = true;

  while (grew) {
    grew = false;

    for (const row of rows) {
      if (
        !collected.has(row.id) &&
        row.predecessorActivityID !== null &&
        collected.has(row.predecessorActivityID)
      ) {
        collected.add(row.id);

        grew = true;
      }
    }
  }

  return collected;
}

async function resetLatestRunRecords(
  context: WorkerContext,
  avatarID: string,
  dropped: ReadonlySet<string>,
  latest: LatestActivityProgress | null,
): Promise<void> {
  const held = context.getLatestRun();

  const lastStarted = await readLastStartedActivity(avatarID);

  // a record naming a run that survives the drop still folds and orders the next mint correctly
  if (held === null || dropped.has(held.activityID)) {
    const replacement =
      latest === null
        ? null
        : {
            activityID: latest.activity.id,
            avatarID,
            baselineXP: latest.optimisticBuild.xp,
            deltaXP: 0,
            tail: null,
          };

    context.setLatestRun(replacement);
  }

  if (lastStarted !== undefined && !dropped.has(lastStarted.lastActivityID)) {
    return;
  }

  if (latest === null) {
    await removeLastStartedActivity(avatarID);

    return;
  }

  await writeLastStartedActivity({ avatarID, lastActivityID: latest.activity.id });
}
