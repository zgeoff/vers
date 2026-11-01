import { isDefinedError, safe } from '@orpc/client';
import type { CheckpointSubmitter } from '../submission/create-checkpoint-submitter';
import { readActivityStart } from '../submission/read-activity-start';
import { readPendingStopIntent } from '../submission/read-pending-stop-intent';
import { readQueuedCheckpoints } from '../submission/read-queued-checkpoints';
import { removePendingStopIntent } from '../submission/remove-pending-stop-intent';
import type { WorkerContext } from './types';

export type PendingStopFlushOutcome = 'delivered' | 'none' | 'undelivered';

const REFUSED_FLUSH_STATES: ReadonlySet<string> = new Set(['evicted', 'invalid']);

export async function flushPendingStop(context: WorkerContext): Promise<PendingStopFlushOutcome> {
  const intent = await readPendingStopIntent();

  if (intent === undefined) {
    return 'none';
  }

  const submitter = context.getSubmitter();

  // the server admits a start only on the anchor its predecessor's last checkpoint leaves, so a run
  // the stopped one chained on offline lands first, or the stopped run's start defers behind it
  for (const activityID of await readStartChain(intent.activityID)) {
    await flushQueue(submitter, activityID, intent.avatarID);
  }

  // a stop request seals the row, so a checkpoint still waiting on the network would never land
  // after it; a stream the server refused never delivers, and the stop goes ahead without it
  const remaining = await readQueuedCheckpoints(intent.activityID, 1);

  const flushState = submitter
    .collectActivityStates()
    .find((state) => state.activityID === intent.activityID)?.state;

  if (remaining.length > 0 && flushState !== undefined && !REFUSED_FLUSH_STATES.has(flushState)) {
    return 'undelivered';
  }

  const [error] = await safe(
    context.getClient().stopActivity({
      activityID: intent.activityID,
      avatarID: intent.avatarID,
    }),
  );

  const superseded =
    isDefinedError(error) && (error.code === 'NOT_FOUND' || error.code === 'SESSION_EVICTED');

  if (error !== null && !superseded) {
    return 'undelivered';
  }

  await removePendingStopIntent(intent.activityID);

  return 'delivered';
}

// oldest first, back to the first activity the server already admitted, which holds no start row
async function readStartChain(activityID: string): Promise<Array<string>> {
  const chain = [activityID];

  let start = await readActivityStart(activityID);

  while (
    start?.predecessorActivityID !== undefined &&
    start.predecessorActivityID !== null &&
    !chain.includes(start.predecessorActivityID)
  ) {
    chain.unshift(start.predecessorActivityID);

    start = await readActivityStart(start.predecessorActivityID);
  }

  return chain;
}

async function flushQueue(
  submitter: CheckpointSubmitter,
  activityID: string,
  avatarID: string,
): Promise<void> {
  const isRegistered = submitter
    .collectActivityStates()
    .some((state) => state.activityID === activityID);

  const queued = await readQueuedCheckpoints(activityID);

  const first = queued.at(0);

  // a worker that booted after the stop holds no stream for the activity, so its queue rebuilds the
  // stream from the outbox rows themselves before the stop request seals the row
  if (!isRegistered && first !== undefined) {
    await submitter.registerActivity({
      activityID,
      appendedHead: first.version - 1,
      avatarID,
      lastHash: first.prevHash,
      startChainIndex: first.payload.chainIndex - first.version,
    });
  } else {
    await submitter.flushNow(activityID);
  }
}
