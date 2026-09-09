import { useQueryClient } from '@tanstack/react-query';
import type { QueryClient } from '@tanstack/react-query';
import { useServerFn } from '@tanstack/react-start';
import { Dialog, StatusButton, Text } from '@vers/design-system';
import type { UndeliveredWork, WorkerClient } from '@vers/idle-client';
import { useState } from 'react';
import { sendIdleReadUndeliveredWork } from '../../lib/idle/send-idle-read-undelivered-work';
import { sendIdleRemoveUndeliveredWork } from '../../lib/idle/send-idle-remove-undelivered-work';
import { useIdleWorkerHandle } from '../../lib/idle/use-idle-worker-handle';
import { orpc } from '../../lib/rpc/orpc';
import { formatUndeliveredPlay } from './format-undelivered-play';
import { signOut } from './sign-out';

interface SignOutFormProps {
  readonly action?: () => Promise<unknown>;
}

interface UndeliveredWarning {
  readonly avatarIDs: ReadonlyArray<string>;
  readonly work: UndeliveredWork;
}

export function SignOutForm(props: Readonly<SignOutFormProps>) {
  const signOutFn = useServerFn(signOut);
  const action = props.action ?? signOutFn;
  const queryClient = useQueryClient();
  const idleWorkerHandle = useIdleWorkerHandle();

  const runSignOut = async (): Promise<void> => {
    await action();

    // the logout redirect is a client-side transition, so without this the signed-out user's
    // cached rows would outlive the session and read as a live session on the next screen
    queryClient.clear();
  };

  const [isPending, setIsPending] = useState(false);
  const [warning, setWarning] = useState<UndeliveredWarning | null>(null);
  const [discardFailed, setDiscardFailed] = useState(false);

  const handleLogoutClick = async (): Promise<void> => {
    const client = idleWorkerHandle.client;

    setIsPending(true);

    try {
      const held = await tryReadUndeliveredWork(
        client,
        queryClient,
        idleWorkerHandle.writerAbortSignal,
      );

      if (held !== null && held.work.activityCount > 0) {
        setWarning(held);

        return;
      }

      await runSignOut();
    } finally {
      setIsPending(false);
    }
  };

  const handleConfirmClick = async (avatarIDs: ReadonlyArray<string>): Promise<void> => {
    const client = idleWorkerHandle.client;

    setIsPending(true);
    setDiscardFailed(false);

    try {
      if (client !== undefined) {
        try {
          await sendIdleRemoveUndeliveredWork(
            client,
            avatarIDs,
            idleWorkerHandle.writerAbortSignal,
          );
        } catch {
          setDiscardFailed(true);

          return;
        }
      }

      await runSignOut();
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
        Log out
      </StatusButton>
      {warning !== null && (
        <Dialog
          closeLabel="Cancel"
          onOpenChange={(open) => {
            if (!open) {
              setWarning(null);
              setDiscardFailed(false);
            }
          }}
          open
          title="Log out and lose this progress?"
        >
          <Text>
            This device is holding {formatUndeliveredPlay(warning.work)} that the server has not
            confirmed.
          </Text>
          <Text>
            Log out now and you give that progress up for good. Cancel to keep it; it delivers once
            the server accepts it.
          </Text>
          {discardFailed && (
            <Text role="alert">
              Clearing that progress failed. Check your connection and try again.
            </Text>
          )}
          <StatusButton
            disabled={isPending}
            onClick={() => void handleConfirmClick(warning.avatarIDs)}
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

async function tryReadUndeliveredWork(
  client: undefined | WorkerClient,
  queryClient: QueryClient,
  signal: AbortSignal,
): Promise<null | UndeliveredWarning> {
  if (client === undefined) {
    return null;
  }

  try {
    const roster = await queryClient.fetchQuery(orpc.avatar.getAvatars.queryOptions({ input: {} }));

    const avatarIDs = roster.avatars.map((avatar) => avatar.id);

    const work = await sendIdleReadUndeliveredWork(client, avatarIDs, signal);

    return { avatarIDs, work };
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
