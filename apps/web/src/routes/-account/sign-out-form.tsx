import { useQueryClient } from '@tanstack/react-query';
import type { QueryClient } from '@tanstack/react-query';
import { useServerFn } from '@tanstack/react-start';
import { Dialog, StatusButton, Text } from '@vers/design-system';
import type { UndeliveredWork, WorkerClient } from '@vers/idle-client';
import { useState } from 'react';
import { match } from 'ts-pattern';
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
  const [isPending, setIsPending] = useState(false);
  const [warning, setWarning] = useState<UndeliveredWarning | null>(null);
  const [discardFailed, setDiscardFailed] = useState(false);
  const [signOutFailed, setSignOutFailed] = useState(false);

  const runSignOut = async (): Promise<void> => {
    try {
      await action();
    } catch {
      setSignOutFailed(true);

      return;
    }

    // the logout redirect is a client-side transition, so without this the signed-out user's
    // cached rows would outlive the session and read as a live session on the next screen
    queryClient.clear();
  };

  const handleLogoutClick = async (): Promise<void> => {
    const client = idleWorkerHandle.client;

    setIsPending(true);
    setSignOutFailed(false);

    try {
      const read = await readUndeliveredWork(
        client,
        queryClient,
        idleWorkerHandle.writerAbortSignal,
      );

      await match(read)
        .with({ kind: 'failed' }, () => {
          setSignOutFailed(true);
        })
        .with({ kind: 'held' }, (held) => {
          setWarning(held.warning);
        })
        .with({ kind: 'none' }, () => runSignOut())
        .exhaustive();
    } finally {
      setIsPending(false);
    }
  };

  const handleConfirmClick = async (avatarIDs: ReadonlyArray<string>): Promise<void> => {
    const client = idleWorkerHandle.client;

    setIsPending(true);
    setDiscardFailed(false);
    setSignOutFailed(false);

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
        status={pickButtonStatus(isPending, signOutFailed)}
        type="button"
      >
        Log out
      </StatusButton>
      {signOutFailed && warning === null && <SignOutFailedAlert />}
      {warning !== null && (
        <Dialog
          closeLabel="Cancel"
          onOpenChange={(open) => {
            if (!open) {
              setWarning(null);
              setDiscardFailed(false);
              setSignOutFailed(false);
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
          {signOutFailed && <SignOutFailedAlert />}
          <StatusButton
            disabled={isPending}
            onClick={() => void handleConfirmClick(warning.avatarIDs)}
            status={pickButtonStatus(isPending, discardFailed || signOutFailed)}
            type="button"
          >
            Log out anyway
          </StatusButton>
        </Dialog>
      )}
    </>
  );
}

type UndeliveredWorkRead =
  | { readonly kind: 'failed' }
  | { readonly kind: 'held'; readonly warning: UndeliveredWarning }
  | { readonly kind: 'none' };

async function readUndeliveredWork(
  client: undefined | WorkerClient,
  queryClient: QueryClient,
  signal: AbortSignal,
): Promise<UndeliveredWorkRead> {
  if (client === undefined) {
    return { kind: 'none' };
  }

  try {
    const roster = await queryClient.query({
      ...orpc.avatar.getAvatars.queryOptions({ input: {} }),
      // the default network mode holds an offline read until the browser reports online, and the
      // player waits on this read with a button that retries it, so it fails at once instead
      networkMode: 'always',
      retry: false,
    });

    const avatarIDs = roster.avatars.map((avatar) => avatar.id);

    const work = await sendIdleReadUndeliveredWork(client, avatarIDs, signal);

    if (work.activityCount === 0) {
      return { kind: 'none' };
    }

    return { kind: 'held', warning: { avatarIDs, work } };
  } catch {
    return { kind: 'failed' };
  }
}

function pickButtonStatus(isPending: boolean, failed: boolean) {
  if (isPending) {
    return StatusButton.Status.Pending;
  }

  if (failed) {
    return StatusButton.Status.Error;
  }

  return StatusButton.Status.Idle;
}

function SignOutFailedAlert() {
  return (
    <Text role="alert">
      Log out needs a network connection. Check your connection and try again.
    </Text>
  );
}
