import { useServerFn } from '@tanstack/react-start';
import { Dialog, StatusButton, Text } from '@vers/design-system';
import type { UndeliveredWork, WorkerClient } from '@vers/idle-client';
import { useState } from 'react';
import { sendIdleReadUndeliveredWork } from '../../lib/idle/send-idle-read-undelivered-work';
import { sendIdleRemoveUndeliveredWork } from '../../lib/idle/send-idle-remove-undelivered-work';
import { useIdleWorkerHandle } from '../../lib/idle/use-idle-worker-handle';
import { formatUndeliveredPlay } from './format-undelivered-play';
import { signOut } from './sign-out';

interface SignOutFormProps {
  readonly action?: () => Promise<unknown>;
}

/**
 * The account hub's sign-out control. A device holding undelivered offline work is warned before
 * the session ends and told what stands to be lost; confirming clears the work so no later
 * sign-in here delivers it, and cancelling ends nothing, leaving the work where it is.
 *
 * The two worker failures resolve opposite ways, because they risk opposite things. A worker that
 * cannot say what it holds signs the player out anyway — it leaves the outbox exactly as today's
 * sign-out does, and trapping a player on this screen behind a dead worker is worse. A discard
 * that fails holds the sign-out back, since ending the session with the work still queued is the
 * one outcome this control exists to prevent.
 */
export function SignOutForm(props: Readonly<SignOutFormProps>) {
  const signOutFn = useServerFn(signOut);
  const action = props.action ?? signOutFn;
  const idleWorkerHandle = useIdleWorkerHandle();
  const [isPending, setIsPending] = useState(false);
  const [report, setReport] = useState<UndeliveredWork | null>(null);
  const [discardFailed, setDiscardFailed] = useState(false);

  const handleLogoutClick = async (): Promise<void> => {
    const client = idleWorkerHandle.client;

    setIsPending(true);

    try {
      const work = await tryReadUndeliveredWork(client, idleWorkerHandle.writerAbortSignal);

      if (work !== null && work.activityCount > 0) {
        setReport(work);

        return;
      }

      await action();
    } finally {
      setIsPending(false);
    }
  };

  const handleConfirmClick = async (): Promise<void> => {
    const client = idleWorkerHandle.client;

    setIsPending(true);
    setDiscardFailed(false);

    try {
      if (client !== undefined) {
        try {
          await sendIdleRemoveUndeliveredWork(client, idleWorkerHandle.writerAbortSignal);
        } catch {
          setDiscardFailed(true);

          return;
        }
      }

      await action();
    } finally {
      setIsPending(false);
    }
  };

  return (
    <>
      <StatusButton
        disabled={isPending}
        onClick={() => void handleLogoutClick()}
        status={isPending ? StatusButton.Status.Pending : StatusButton.Status.Idle}
        type="button"
      >
        Logout
      </StatusButton>
      {report !== null && (
        <Dialog
          closeLabel="Cancel"
          onOpenChange={(open) => {
            if (!open) {
              setReport(null);
              setDiscardFailed(false);
            }
          }}
          open
          title="Log out and lose this progress?"
        >
          <Text>
            This device is holding {formatUndeliveredPlay(report)} that the server has not
            confirmed.
          </Text>
          <Text>
            Log out now and you give that progress up for good. Cancel, get back online, and it
            delivers instead.
          </Text>
          {discardFailed && (
            <Text role="alert">
              Clearing that progress failed. Check your connection and try again.
            </Text>
          )}
          <StatusButton
            disabled={isPending}
            onClick={() => void handleConfirmClick()}
            status={pickConfirmStatus(isPending, discardFailed)}
            type="button"
          >
            Log out anyway
          </StatusButton>
        </Dialog>
      )}
    </>
  );
}

/**
 * Asks the worker what it is holding, answering null for a device with no worker to ask and for a
 * worker that fails to answer — both sign the player straight out. Only this read is guarded, so a
 * rejected sign-out surfaces as its own failure rather than being retried behind a fallback.
 */
async function tryReadUndeliveredWork(
  client: undefined | WorkerClient,
  signal: AbortSignal,
): Promise<UndeliveredWork | null> {
  if (client === undefined) {
    return null;
  }

  try {
    return await sendIdleReadUndeliveredWork(client, signal);
  } catch {
    return null;
  }
}

function pickConfirmStatus(isPending: boolean, discardFailed: boolean) {
  if (isPending) {
    return StatusButton.Status.Pending;
  }

  if (discardFailed) {
    return StatusButton.Status.Error;
  }

  return StatusButton.Status.Idle;
}
