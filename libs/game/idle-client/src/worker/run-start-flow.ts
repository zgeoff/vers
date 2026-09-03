import type { ActivityData } from '@vers/contract-activity';
import { writeActivityStart } from '../submission/write-activity-start';
import { writeLastStartedActivity } from '../submission/write-last-started-activity';
import { buildActivityStart } from './build-activity-start';
import { handleSetActivityMessage } from './handle-set-activity-message';
import { submitStopIntent } from './submit-stop-intent';
import type { FlowSignals, StartActivityInput, WorkerContext } from './types';
import type { StartStatus } from './worker-contract';

export async function runStartFlow(
  context: WorkerContext,
  input: Readonly<StartActivityInput>,
  token: string,
  signals: Readonly<FlowSignals>,
): Promise<StartStatus> {
  // a pure unwind: no row has been minted yet, so there is nothing to compensate
  if (isSuperseded(context, token)) {
    return { kind: 'failed' };
  }

  signals.cancel.throwIfAborted();

  const live = context.getActivity();

  // the live run this flow must stop back before installing: an installed row whose simulation is
  // the one actually ticking, not a stopped remnant or a row left by another avatar's turn
  const running = live !== null && context.getSimulation().activity?.id === live.id ? live : null;

  // already running here — the player's request is already satisfied, and re-minting would fork
  // the checkpoint stream the live simulation is already advancing
  if (
    running !== null &&
    running.avatarID === input.avatarID &&
    running.scopeType === input.scopeType &&
    running.scopeID === input.scopeID
  ) {
    return { activityID: running.id, kind: 'attached' };
  }

  // the mint is attempted before the live run is stopped: a mint that fails (a missing cache)
  // leaves the current run intact rather than stranding the worker with no live run and a stale
  // stopped one
  const row = await buildActivityStart(context, { ...input, startKey: token });

  if (row === null) {
    return { kind: 'failed' };
  }

  if (running !== null) {
    // `simulation.startActivity` auto-stops a live generator, but only once this flow reaches it;
    // every await before then is a window the old run would keep advancing in
    context.getSimulation().stopActivity();

    // submitStopIntent flushes the row's earned checkpoints before the stop lands, so they reach
    // the server ahead of the row closing to further appends
    await submitStopIntent(context, { avatarID: running.avatarID, id: running.id });

    context.resetRewardSlotLedger();

    if (isSuperseded(context, token)) {
      return { kind: 'failed' };
    }
  }

  // written before install: a crash here still leaves a recoverable activity start for a later
  // reconcile
  await writeActivityStart(row);

  // durable so the row's own predecessor reference stays recoverable across a worker reload; a
  // later start for this avatar reads it back as its own predecessor
  await writeLastStartedActivity({ avatarID: row.avatarID, lastActivityID: row.id });

  if (isSuperseded(context, token)) {
    return { kind: 'failed' };
  }

  return setLiveStartedRow(context, token, row, signals);
}

function isSuperseded(context: WorkerContext, token: string): boolean {
  return context.getStartToken() !== token;
}

async function setLiveStartedRow(
  context: WorkerContext,
  token: string,
  row: Readonly<ActivityData>,
  signals: Readonly<FlowSignals>,
): Promise<StartStatus> {
  // a stop landed mid-start: the fresh row is stopped back durably, as any player stop delivers
  if (signals.stop.aborted) {
    await submitStopIntent(context, row);

    return { kind: 'failed' };
  }

  if (isSuperseded(context, token)) {
    return { kind: 'failed' };
  }

  await handleSetActivityMessage(context, { activity: row });

  // the install's registration await is this flow's last yield; a call that arrived during it
  // owns the claim, and its queued flow will replace this install
  if (isSuperseded(context, token)) {
    return { kind: 'failed' };
  }

  return { activity: row, kind: 'started' };
}
