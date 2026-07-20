import { Button, Dialog, Text } from '@vers/design-system';
import { setResyncStatus, useResyncStatus } from '@vers/idle-client';
import type { ResyncStatus } from '@vers/idle-client';
import { getLoginPathWithRedirect } from '../../lib/auth/get-login-path-with-redirect';
import { sendIdleRequestResync } from '../../lib/idle/send-idle-request-resync';
import { useIdleWorkerHandle } from '../../lib/idle/use-idle-worker-handle';

/**
 * Masks the offline catch-up after an away-and-return: it opens the moment a resync starts
 * fast-forwarding a real away period, reports attempts and level-ups as they land, and stays up
 * with the final tally (or the cap notice) until dismissed. A resync with no away period to
 * report — a fresh login, a zero-gap reconnect — broadcasts no status, so it never opens this. A
 * resync that fails outright opens on a retry action instead; one stopped by an expired session
 * opens on a sign-in link, since no retry can succeed until the player signs back in — the login
 * redirect returns them here, where the fresh session's own resync resumes the catch-up.
 */
export function WelcomeBackModal() {
  const resyncStatus = useResyncStatus();

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
      <ResyncOutcome resyncStatus={resyncStatus} />
    </Dialog>
  );
}

interface ResyncOutcomeProps {
  readonly resyncStatus: ResyncStatus;
}

function ResyncOutcome(props: Readonly<ResyncOutcomeProps>) {
  const resyncStatus = props.resyncStatus;
  const idleWorkerHandle = useIdleWorkerHandle();

  if (resyncStatus.kind === 'session-expired') {
    return (
      <>
        <Text>Your session expired while catching up. Your progress is safe.</Text>
        <Button as="a" href={getLoginPathWithRedirect(globalThis.location)}>
          Sign in
        </Button>
      </>
    );
  }

  if (resyncStatus.kind === 'active-elsewhere') {
    return <Text>Your run picked up on another device, so it&rsquo;s paused here.</Text>;
  }

  if (resyncStatus.kind === 'failed') {
    return (
      <>
        <Text>Catching up didn’t finish. Your progress is safe.</Text>
        <Button
          onClick={() => {
            if (idleWorkerHandle.worker !== undefined) {
              sendIdleRequestResync(idleWorkerHandle.worker, resyncStatus.avatarID, true);
            }

            setResyncStatus(null);
          }}
        >
          Try again
        </Button>
      </>
    );
  }

  return <Text>{formatResyncStatus(resyncStatus)}</Text>;
}

function formatResyncStatus(
  resyncStatus: Readonly<
    Exclude<
      ResyncStatus,
      | { readonly kind: 'active-elsewhere' }
      | { readonly kind: 'failed' }
      | { readonly kind: 'session-expired' }
    >
  >,
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
