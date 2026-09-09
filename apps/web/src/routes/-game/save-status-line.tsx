import { Text } from '@vers/design-system';
import { useSaveStatus, useStoragePersistence } from '@vers/idle-client';

export function SaveStatusLine() {
  const saveStatus = useSaveStatus();
  const persistence = useStoragePersistence();

  if (saveStatus === null) {
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
