import { Button, Dialog, Text } from '@vers/design-system';
import { setResyncStatus, useResyncStatus } from '@vers/idle-client';
import type { ResyncStatus } from '@vers/idle-client';
import { AvatarSwitchedNotice } from '../../components/avatar-switched-notice';
import { GameUpdatedNotice } from '../../components/game-updated-notice';
import { getLoginPathWithRedirect } from '../../lib/auth/get-login-path-with-redirect';
import { runIgnoringRejection } from '../../lib/idle/run-ignoring-rejection';
import { sendIdleReportOnline } from '../../lib/idle/send-idle-report-online';
import { useIdleWorkerHandle } from '../../lib/idle/use-idle-worker-handle';

export function WelcomeBackModal() {
  const resyncStatus = useResyncStatus();

  if (resyncStatus === null) {
    return null;
  }

  // a catch-up ended by another device taking the run resolves in the playing-elsewhere notice —
  // a second dialog saying the same thing helps nobody
  if (resyncStatus.kind === 'active-elsewhere') {
    return null;
  }

  if (resyncStatus.kind === 'fast-forwarding') {
    return (
      <Dialog dismissible={false} open title="Welcome back">
        <Text>Catching up… {formatTally(resyncStatus)} so far.</Text>
      </Dialog>
    );
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

interface ResyncTally {
  readonly attempts: number;
  readonly levelUps: number;
}

function formatTally(tally: Readonly<ResyncTally>): string {
  return `${formatCount(tally.attempts, 'attempt')}, ${formatCount(tally.levelUps, 'level-up')}`;
}

function formatCount(count: number, unit: string): string {
  return `${count} ${unit}${count === 1 ? '' : 's'}`;
}

interface ResyncOutcomeProps {
  readonly resyncStatus: Exclude<
    ResyncStatus,
    { readonly kind: 'active-elsewhere' } | { readonly kind: 'fast-forwarding' }
  >;
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

  if (resyncStatus.kind === 'avatar-switched') {
    return (
      <AvatarSwitchedNotice
        activeAvatarName={resyncStatus.activeAvatarName}
        attempts={resyncStatus.attempts}
        levelUps={resyncStatus.levelUps}
      />
    );
  }

  if (resyncStatus.kind === 'sim-version-expired') {
    return <GameUpdatedNotice />;
  }

  if (resyncStatus.kind === 'failed') {
    return (
      <>
        <Text>Catching up didn’t finish. Your progress is safe.</Text>
        <Button
          onClick={() => {
            if (idleWorkerHandle.client !== undefined) {
              runIgnoringRejection(
                sendIdleReportOnline(
                  idleWorkerHandle.client,
                  resyncStatus.avatarID,
                  true,
                  idleWorkerHandle.writerAbortSignal,
                ),
              );
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
      | { readonly kind: 'avatar-switched' }
      | { readonly kind: 'failed' }
      | { readonly kind: 'fast-forwarding' }
      | { readonly kind: 'session-expired' }
      | { readonly kind: 'sim-version-expired' }
    >
  >,
): string {
  if (resyncStatus.kind === 'capped') {
    return 'Offline progress reached its cap. Your avatar held position — jump back in to continue.';
  }

  return `While you were away: ${formatTally(resyncStatus)}.`;
}
