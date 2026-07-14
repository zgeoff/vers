import { Text } from '@vers/design-system';
import { useOfflineCapStatus } from '@vers/idle-client';

/**
 * Warns a present-but-disconnected player as the offline-progress budget drains: no modal can
 * mask a live simulation, so the warning sits beside the encounter, switching to the paused
 * notice once the worker halts at an encounter boundary.
 */
export function ApproachingCapWarning() {
  const offlineCapStatus = useOfflineCapStatus();

  if (offlineCapStatus === null) {
    return null;
  }

  if (offlineCapStatus.halted) {
    return <Text>Progress is paused — reconnect to continue.</Text>;
  }

  return (
    <Text>
      Reconnect within {formatRemaining(offlineCapStatus.remainingMs)} to keep progressing.
    </Text>
  );
}

function formatRemaining(remainingMs: number): string {
  const totalMinutes = Math.max(1, Math.floor(remainingMs / 60_000));
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;

  if (hours === 0) {
    return `${minutes}m`;
  }

  return minutes === 0 ? `${hours}h` : `${hours}h ${minutes}m`;
}
