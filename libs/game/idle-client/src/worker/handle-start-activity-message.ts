import type { ActivityData } from '@vers/contract-activity';
import { writeStartRow } from '../submission/write-start-row';
import { buildStartRow } from './build-start-row';
import { handleSetActivityMessage } from './handle-set-activity-message';
import { isAbortError } from './is-abort-error';
import { reportWorkerFault } from './report-worker-fault';
import { submitStopIntent } from './submit-stop-intent';
import type { FlowSignals, WorkerContext } from './types';
import { withLifecycleTurn } from './with-lifecycle-turn';
import type { StartStatus } from './worker-contract';

interface StartActivityInput {
  readonly avatarID: string;
  readonly scopeID: string;
  readonly scopeType: string;
}

/**
 * Begins a run entirely inside the worker, resolving the single-active-run invariant locally
 * rather than by round-tripping the server: a request naming the avatar, scope, and simulation
 * already live here answers `attached` without minting anything; any other request mints a fresh
 * local row (`buildStartRow`) and installs it, stopping a genuinely running live run back first
 * only once the mint has succeeded — a mint that fails leaves the current run untouched rather
 * than stranding the worker with no live run and a stale stopped one. The minted row is persisted
 * durably before it installs, so a crash between mint and install still leaves a recoverable root.
 * The call mints a fresh worker-internal token at entry and re-checks it after every await — a
 * fresher call can land while this turn runs, and a superseded flow answers `failed`, leaving its
 * minted row to the fresher flow's recovery. A stop landing mid-start stops the minted row back
 * durably. An abort settles as `failed` without a fault report.
 */
export async function handleStartActivityMessage(
  context: WorkerContext,
  input: Readonly<StartActivityInput>,
): Promise<StartStatus> {
  const token = crypto.randomUUID();

  context.setStartToken(token);

  // withLifecycleTurn discards its callback's return value, so the outcome is captured here and
  // returned once the turn settles rather than threaded through it
  let status: StartStatus = { kind: 'failed' };

  await withLifecycleTurn(context, 'start', async () => {
    const signals: FlowSignals = {
      cancel: context.getCancelSignal(),
      stop: context.getStopSignal(),
    };

    // failures settle as a failed status rather than escaping into the mailbox's fault report
    try {
      status = await runStart(context, input, token, signals);
    } catch (error) {
      if (!isAbortError(error, signals.cancel)) {
        reportWorkerFault('start', error);
      }

      status = { kind: 'failed' };
    }
  });

  return status;
}

async function runStart(
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
  // the chain the live simulation is already advancing
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
  const row = await buildStartRow(context, { ...input, startKey: token });

  if (row === null) {
    return { kind: 'failed' };
  }

  if (running !== null) {
    // silences the old simulation's ticking before the new row installs — `simulation.startActivity`
    // auto-stops a live generator on its own, but only once this flow reaches it, and every await
    // between here and there is a window the old run would otherwise keep advancing in
    context.getSimulation().stopActivity();

    // submitStopIntent flushes the row's earned checkpoints before the stop lands, so they reach
    // the server ahead of the row closing to further appends
    await submitStopIntent(context, { avatarID: running.avatarID, id: running.id });

    context.resetRewardSlotLedger();

    if (isSuperseded(context, token)) {
      return { kind: 'failed' };
    }
  }

  // written before install: a crash here still leaves a recoverable root for a later reconcile
  await writeStartRow(row);

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
