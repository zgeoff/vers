import { Button, Dialog, Text } from '@vers/design-system';
import { setResyncStatus, useResyncStatus } from '@vers/idle-client';
import type { ResyncStatus } from '@vers/idle-client';
import { sendIdleRequestResync } from '../../lib/idle/send-idle-request-resync';
import { useIdleWorkerHandle } from '../../lib/idle/use-idle-worker-handle';

/**
 * Masks the offline catch-up after an away-and-return: it opens the moment a resync starts
 * fast-forwarding a real away period, reports attempts and level-ups as they land, and stays up
 * with the final tally (or the cap notice) until dismissed. A resync with no away period to
 * report — a fresh login, a zero-gap reconnect — broadcasts no status, so it never opens this. A
 * resync that fails outright opens on a retry action instead.
 */
export function WelcomeBackModal() {
  const resyncStatus = useResyncStatus();
  const idleWorkerHandle = useIdleWorkerHandle();

  if (resyncStatus === null) {
    return null;
  }

  return (
    <Dialog
      onOpenChange={(open) => {
        if (!open) {
          setResyncStatus(null);
        }
      }}
      open
      title="Welcome back"
    >
      {resyncStatus.kind === 'failed' ? (
        <>
          <Text>Catching up didn’t finish. Your progress is safe.</Text>
          <Button
            onClick={() => {
              if (idleWorkerHandle.worker !== undefined) {
                sendIdleRequestResync(idleWorkerHandle.worker, resyncStatus.avatarID);
              }

              setResyncStatus(null);
            }}
          >
            Try again
          </Button>
        </>
      ) : (
        <Text>{formatResyncStatus(resyncStatus)}</Text>
      )}
    </Dialog>
  );
}

function formatResyncStatus(
  resyncStatus: Readonly<Exclude<ResyncStatus, { readonly kind: 'failed' }>>,
): string {
  if (resyncStatus.kind === 'capped') {
    return 'Offline progress reached its cap. Your avatar held position — jump back in to continue.';
  }

  const tally = `${resyncStatus.attempts} attempts, ${resyncStatus.levelUps} level-ups`;

  if (resyncStatus.kind === 'fast-forwarding') {
    return `Catching up… ${tally} so far.`;
  }

  return `While you were away: ${tally}.`;
}
