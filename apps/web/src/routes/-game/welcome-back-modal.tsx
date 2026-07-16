import { Dialog, Text } from '@vers/design-system';
import { setResyncStatus, useResyncStatus } from '@vers/idle-client';
import type { ResyncStatus } from '@vers/idle-client';

/**
 * Masks the offline catch-up after an away-and-return: it opens the moment a resync starts
 * fast-forwarding a real away period, reports attempts and level-ups as they land, and stays up
 * with the final tally (or the cap notice) until dismissed. A resync with no away period to
 * report — a fresh login, a zero-gap reconnect — broadcasts no status, so it never opens this.
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
      <Text>{formatResyncStatus(resyncStatus)}</Text>
    </Dialog>
  );
}

function formatResyncStatus(resyncStatus: Readonly<ResyncStatus>): string {
  if (resyncStatus.kind === 'capped') {
    return 'Offline progress reached its cap. Your avatar held position — jump back in to continue.';
  }

  const tally = `${resyncStatus.attempts} attempts, ${resyncStatus.levelUps} level-ups`;

  if (resyncStatus.kind === 'fast-forwarding') {
    return `Catching up… ${tally} so far.`;
  }

  return `While you were away: ${tally}.`;
}
