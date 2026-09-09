import { Text } from '@vers/design-system';
import { useActivity, useSaveStatus, useStoragePersistence } from '@vers/idle-client';

export function SaveStatusLine() {
  const saveStatus = useSaveStatus();
  const persistence = useStoragePersistence();
  const activity = useActivity();

  // a report for the previous run stays in the store until the live run's first save lands
  if (saveStatus === null || activity === null || saveStatus.activityID !== activity.id) {
    return null;
  }

  const saved =
    saveStatus.savedVersion === null ? 'nothing saved yet' : `saved ${saveStatus.savedVersion}`;

  const received =
    saveStatus.receivedVersion === null
      ? 'server has none'
      : `server has ${saveStatus.receivedVersion}`;

  return (
    <Text>
      This device: {saved} · {received} · Offline saves: {pickPersistenceLabel(persistence)}
    </Text>
  );
}

function pickPersistenceLabel(
  persistence: 'denied' | 'granted' | 'unavailable' | 'unknown',
): string {
  if (persistence === 'granted') {
    return 'kept';
  }

  if (persistence === 'denied') {
    return 'best effort';
  }

  return persistence === 'unavailable' ? 'not offered by this browser' : 'not asked yet';
}
