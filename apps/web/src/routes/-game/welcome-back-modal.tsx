import { Button, Dialog, Text } from '@vers/design-system';
import { setResyncStatus, useResyncStatus } from '@vers/idle-client';
import type { ResyncStatus } from '@vers/idle-client';
import { AvatarSwitchedNotice } from '../../components/avatar-switched-notice';
import { GameUpdatedNotice } from '../../components/game-updated-notice';
import { getLoginPathWithRedirect } from '../../lib/auth/get-login-path-with-redirect';
import { runIgnoringRejection } from '../../lib/idle/run-ignoring-rejection';
import { sendIdleReportOnline } from '../../lib/idle/send-idle-report-online';
import { useIdleWorkerHandle } from '../../lib/idle/use-idle-worker-handle';

/**
 * Masks the offline catch-up after an away-and-return: it opens the moment a resync starts
 * fast-forwarding a real away period, reports attempts and level-ups as they land, and stays up
 * with the final tally (or the cap notice) until dismissed. A resync with no away period to
 * report — a fresh login, a zero-gap reconnect — broadcasts no status, so it never opens this. A
 * resync that fails outright opens on a retry action instead; one stopped by an expired session
 * opens on a sign-in link, since no retry can succeed until the player signs back in — the login
 * redirect returns them here, where the fresh session's own resync resumes the catch-up. A resync
 * dropped for an avatar the account switched away from opens on a reload action — the tab's own
 * state still names the old avatar, and only a reload re-runs every gate against the new one. A
 * resync dropped because the running build's engine no longer supports the current content also
 * opens on a reload action, for the same reason: no in-page recovery can fetch a newer bundle.
 * While the catch-up is still fast-forwarding, the dialog is a non-dismissible lockout — the
 * player can't act on stale state until the resync settles into one of its terminal outcomes.
 */
export function WelcomeBackModal() {
  const resyncStatus = useResyncStatus();

  if (resyncStatus === null) {
    return null;
  }

  // a catch-up ended by another device taking the run resolves in the playing-elsewhere notice,
  // which carries the take-back action — a second dialog saying the same thing helps nobody
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
