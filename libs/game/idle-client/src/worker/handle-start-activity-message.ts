import type { ORPCError } from '@orpc/client';
import { isDefinedError, safe } from '@orpc/client';
import type { ActivityData } from '@vers/contract-activity';
import { handleSetActivityMessage } from './handle-set-activity-message';
import { isAbortError } from './is-abort-error';
import { reportWorkerFault } from './report-worker-fault';
import { runResyncFlow } from './run-resync-flow';
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
 * Begins a run entirely inside the worker, answering with the outcome directly. A same-scope
 * `CONFLICT` resyncs onto the running row, answering `attached` only once the runtime holds it; a
 * different-scope `CONFLICT` flushes that row, stops it targeted, and retries. The call mints a
 * fresh worker-internal token at entry and re-checks it after every await — a fresher call can
 * land while this turn runs, and a superseded flow answers `failed`, leaving its minted row to the
 * fresher flow's recovery. A stop landing mid-start stops the minted row back durably. An abort
 * settles as `failed` without a fault report.
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
  // a queued flow may be stale before it ever runs
  if (isSuperseded(context, token)) {
    return { kind: 'failed' };
  }

  // a pure unwind: no row has been minted yet, so there is nothing to compensate
  signals.cancel.throwIfAborted();

  const [error, started] = await tryStartActivity(context, input, token);

  if (error === null) {
    return setLiveStartedRow(context, token, started, signals);
  }

  if (isDefinedError(error) && error.code === 'AVATAR_NOT_ACTIVE') {
    return {
      kind: 'failed',
      rejection: { activeAvatarName: error.data.activeAvatarName, reason: 'avatar-not-active' },
    };
  }

  if (!isDefinedError(error) || error.code !== 'CONFLICT') {
    // a defined rejection is the service answering; anything else belongs in the error backend
    if (!isDefinedError(error)) {
      reportWorkerFault('start', error);
    }

    return { kind: 'failed' };
  }

  const row = error.data.activity;

  // the requested scope is already running — a resync attaches its confirmed stream, claiming
  // the writer since the player's start is a deliberate attach; called inner-to-inner, since
  // queueing a turn from inside this turn would deadlock the mailbox
  if (row.scopeType === input.scopeType && row.scopeID === input.scopeID) {
    await runResyncFlow(context, input.avatarID, true, signals);

    // a resync can be skipped, gated, or abandoned without installing; reporting attached anyway
    // would leave the tab waiting forever on a run that never arrives
    if (context.getSimulation().activity?.id !== row.id) {
      return { kind: 'failed' };
    }

    return { activityID: row.id, kind: 'attached' };
  }

  // a superseded call must not stop a row the fresher selection may be attaching to
  if (isSuperseded(context, token)) {
    return { kind: 'failed' };
  }

  // replace flow: earned checkpoints land before the stop closes the row to appends
  await context.getSubmitter().flushNow(row.id);

  // the flush yields — a fresher call landing during it may be attaching to this very row, so
  // the stop must not proceed on a stale claim
  if (isSuperseded(context, token)) {
    return { kind: 'failed' };
  }

  if (!(await stopConflictingRow(context, row.id, input.avatarID))) {
    return { kind: 'failed' };
  }

  const [retryError, retried] = await tryStartActivity(context, input, token);

  if (retryError !== null) {
    if (isDefinedError(retryError) && retryError.code === 'AVATAR_NOT_ACTIVE') {
      return {
        kind: 'failed',
        rejection: {
          activeAvatarName: retryError.data.activeAvatarName,
          reason: 'avatar-not-active',
        },
      };
    }

    if (!isDefinedError(retryError)) {
      reportWorkerFault('start', retryError);
    }

    return { kind: 'failed' };
  }

  return setLiveStartedRow(context, token, retried, signals);
}

function isSuperseded(context: WorkerContext, token: string): boolean {
  return context.getStartToken() !== token;
}

/**
 * One start-activity mint, deliberately unsigned: the response is the only handle on the minted
 * row, and the stop-back compensation needs it.
 */
function tryStartActivity(
  context: WorkerContext,
  input: Readonly<StartActivityInput>,
  token: string,
) {
  return safe(
    context.getClient().startActivity({
      avatarID: input.avatarID,
      scopeID: input.scopeID,
      scopeType: input.scopeType,
      startKey: token,
    }),
  );
}

/**
 * Whether a stop attempt achieved all a stop can: the call succeeded, or `NOT_FOUND` says the row
 * already left `active`.
 */
function isStopSettled(error: Error | null | ORPCError<string, unknown>): boolean {
  return error === null || (isDefinedError(error) && error.code === 'NOT_FOUND');
}

/**
 * Stops the different-scope row a replace-flow start conflicts with, reporting whether the row is
 * closed to further appends. A stop rejected with SESSION_EVICTED means another session's writer
 * owns the run — the player's start here is a deliberate act that supersedes it, so this session
 * claims the writer and retries the stop once. A claim answering NOT_FOUND means the row already
 * left `active`, which is all a stop could have achieved. Its stop and claim calls further the
 * stop's own goal, so none of them take the signal — aborting would help nothing.
 */
async function stopConflictingRow(
  context: WorkerContext,
  activityID: string,
  avatarID: string,
): Promise<boolean> {
  const [stopError] = await safe(context.getClient().stopActivity({ activityID, avatarID }));

  if (isStopSettled(stopError)) {
    return true;
  }

  if (!isDefinedError(stopError)) {
    reportWorkerFault('start', stopError);

    return false;
  }

  if (stopError.code !== 'SESSION_EVICTED') {
    return false;
  }

  const [claimError] = await safe(context.getClient().resumeActivity({ activityID }));

  if (claimError !== null) {
    if (isDefinedError(claimError) && claimError.code === 'NOT_FOUND') {
      return true;
    }

    if (!isDefinedError(claimError)) {
      reportWorkerFault('start', claimError);
    }

    return false;
  }

  const [retryError] = await safe(context.getClient().stopActivity({ activityID, avatarID }));

  if (isStopSettled(retryError)) {
    return true;
  }

  if (!isDefinedError(retryError)) {
    reportWorkerFault('start', retryError);
  }

  return false;
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
