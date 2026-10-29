import type { ActivityData } from '@vers/contract-activity';
import type { LatestActivityProgress } from '../resync/types';
import { readAllActivityStarts } from '../submission/read-all-activity-starts';
import { readLastStartedActivity } from '../submission/read-last-started-activity';
import { removeActivityStart } from '../submission/remove-activity-start';
import { removeLastStartedActivity } from '../submission/remove-last-started-activity';
import { removeQueuedCheckpoints } from '../submission/remove-queued-checkpoints';
import type { NodeSeedAnchor } from '../submission/types';
import { writeLastStartedActivity } from '../submission/write-last-started-activity';
import { writeRewoundNodeAnchor } from '../submission/write-rewound-node-anchor';
import { writeServerNodeAnchor } from '../submission/write-server-node-anchor';
import { WorkerMessageType } from '../types';
import { handleSimulationUpdate } from './handle-simulation-update';
import { resetSimulation } from './reset-simulation';
import { RunOutcomeKind } from './run-outcome-schema';
import type { WorkerContext } from './types';

interface RejectActivityStartInput {
  readonly anchor?: NodeSeedAnchor;
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

  const starts = await readAllActivityStarts();

  const pending = starts.filter((candidate) => candidate.avatarID === row.avatarID);
  const dropped = collectChainedStartIDs(pending, row.id);

  const waitingIDs = new Set(
    pending.map((candidate) => candidate.id).filter((activityID) => !dropped.has(activityID)),
  );

  const held = context.getActivity();
  const heldDropped = held !== null && dropped.has(held.id);
  const ended = heldDropped ? held : row;

  if (heldDropped) {
    context.getSimulation().stopActivity();

    // a tab that sees the run cleared before it sees the refusal reads no run and no outcome, and
    // leaves the refusal for the map
    broadcastRefusedOutcome(context, ended);
    resetSimulation(context);

    context.resetRewardSlotLedger();

    handleSimulationUpdate(context);
  }

  await resetLatestRunRecords(context, {
    avatarID: row.avatarID,
    dropped,
    latest: input.latest,
    waitingIDs,
  });

  // written once the held run has halted: a tick of the refused run still advances the cached
  // anchor past the server's, so a reset before the halt is overwritten
  for (const rewound of collectDroppedStartAnchors([row, ...pending], dropped)) {
    await writeRewoundNodeAnchor(row.avatarID, rewound.nodeID, rewound.anchor);
  }

  if (input.anchor !== undefined) {
    await writeServerNodeAnchor(row.avatarID, row.scopeID, input.anchor);
  }

  // removed only once their anchors are rewound: a drop that stops before this point still finds
  // every dropped start, and its anchor, on the retry
  for (const activityID of dropped) {
    if (activityID !== row.id) {
      await removeQueuedCheckpoints(activityID);
      await removeActivityStart(activityID);
    }
  }

  // the root row goes last, after its own queue: a drop that fails before this point leaves it in
  // the store, and the next reconnect re-ingests it, is refused again, and repeats the whole drop
  await removeQueuedCheckpoints(row.id);
  await removeActivityStart(row.id);

  context
    .getDebugRecorder()
    .recordEvent(
      'refusal',
      [
        row.id,
        `held=${heldDropped ? held.id : 'none'}`,
        `dropped=${[...dropped].join(',')}`,
        `anchor=${input.anchor === undefined ? 'none' : input.anchor.chainIndex}`,
      ].join(' '),
    );

  if (!heldDropped) {
    broadcastRefusedOutcome(context, ended);
  }
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

function broadcastRefusedOutcome(context: WorkerContext, ended: Readonly<ActivityData>): void {
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

interface ResetLatestRunRecordsInput {
  readonly avatarID: string;
  readonly dropped: ReadonlySet<string>;
  readonly latest: LatestActivityProgress | null;
  readonly waitingIDs: ReadonlySet<string>;
}

async function resetLatestRunRecords(
  context: WorkerContext,
  input: Readonly<ResetLatestRunRecordsInput>,
): Promise<void> {
  const avatarID = input.avatarID;
  const latest = input.latest;
  const held = context.getLatestRun();

  const lastStarted = await readLastStartedActivity(avatarID);

  // a server holding no activity for the avatar, as after an account reset, has no row behind a
  // record that names anything but a start still waiting in this device's outbox
  const isStale = (activityID: string) =>
    input.dropped.has(activityID) || (latest === null && !input.waitingIDs.has(activityID));

  // a record naming a run that survives the drop still folds and orders the next mint correctly
  if (held === null || (held.avatarID === avatarID && isStale(held.activityID))) {
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

  if (lastStarted !== undefined && !isStale(lastStarted.lastActivityID)) {
    return;
  }

  if (latest === null) {
    await removeLastStartedActivity(avatarID);

    return;
  }

  await writeLastStartedActivity({ avatarID, lastActivityID: latest.activity.id });
}

interface DroppedStartAnchor {
  readonly anchor: NodeSeedAnchor;
  readonly nodeID: string;
}

// a dropped start's own anchor is where its node's chain stood when the device minted it, and the
// server appended nothing for it, so the earliest one per node is the position the next start
// draws from
function collectDroppedStartAnchors(
  rows: ReadonlyArray<ActivityData>,
  dropped: ReadonlySet<string>,
): ReadonlyArray<DroppedStartAnchor> {
  const earliest = new Map<string, ActivityData>();

  for (const candidate of rows) {
    const current = earliest.get(candidate.scopeID);

    if (
      dropped.has(candidate.id) &&
      (current === undefined || candidate.startChainIndex < current.startChainIndex)
    ) {
      earliest.set(candidate.scopeID, candidate);
    }
  }

  return [...earliest.values()].map((start) => ({
    anchor: { chainIndex: start.startChainIndex, nextSeed: start.seed },
    nodeID: start.scopeID,
  }));
}
