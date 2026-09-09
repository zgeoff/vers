import { Dialog, Text } from '@vers/design-system';
import { setJournalFailure, useJournalFailure, useSaveStatus } from '@vers/idle-client';

export function JournalFailureNotice() {
  const failure = useJournalFailure();
  const saveStatus = useSaveStatus();

  if (failure === null) {
    return null;
  }

  const received =
    saveStatus !== null && saveStatus.activityID === failure.activityID
      ? saveStatus.receivedVersion
      : null;

  const receivedLine =
    received === null
      ? 'The server has not received any of this run yet.'
      : `The server has received this run up to save ${received}.`;

  return (
    <Dialog
      onOpenChange={(open) => {
        if (!open) {
          setJournalFailure(null);
        }
      }}
      open
      title={pickTitle(failure.kind)}
    >
      <Text>{pickBody(failure.kind)}</Text>
      <Text>{receivedLine}</Text>
    </Dialog>
  );
}

function pickTitle(kind: 'quota' | 'unreadable' | 'write'): string {
  if (kind === 'unreadable') {
    return 'Saved history is missing';
  }

  return kind === 'quota' ? 'This device is out of storage' : 'This device could not save';
}

function pickBody(kind: 'quota' | 'unreadable' | 'write'): string {
  if (kind === 'unreadable') {
    return 'This device cannot read its saved history, so anything the server has not received is lost. Reload to continue from what the server holds.';
  }

  if (kind === 'quota') {
    return 'The run stopped at the last save it could keep. Free up storage for this site, then reload to continue.';
  }

  return 'The run stopped at the last save it could keep. Reload to continue; if this repeats, this browser cannot keep offline progress.';
}
