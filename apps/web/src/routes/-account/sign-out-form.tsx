import { useServerFn } from '@tanstack/react-start';
import { Dialog, StatusButton, Text } from '@vers/design-system';
import type { UndeliveredWork } from '@vers/idle-client';
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
      if (client === undefined) {
        await action();

        return;
      }

      const work = await sendIdleReadUndeliveredWork(client, idleWorkerHandle.writerAbortSignal);

      if (work.activityCount === 0) {
        await action();

        return;
      }

      setReport(work);
    } catch {
      // an unreachable worker can't report what it holds, and blocking sign-out on it would be
      // worse than today's behaviour
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
          // the player confirmed losing this work, but a failed discard leaves it queued — signing
          // out anyway would let a later sign-in here deliver exactly what this dialog exists to
          // stop, so report the failure and leave the dialog open for a retry instead
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
            This device is holding {formatUndeliveredPlay(report)} that the server has never seen.
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

function pickConfirmStatus(isPending: boolean, discardFailed: boolean) {
  if (isPending) {
    return StatusButton.Status.Pending;
  }

  if (discardFailed) {
    return StatusButton.Status.Error;
  }

  return StatusButton.Status.Idle;
}
