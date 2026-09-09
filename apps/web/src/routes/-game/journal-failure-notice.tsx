import { Dialog, Text } from '@vers/design-system';
import { setJournalFailure, useJournalFailure } from '@vers/idle-client';

export function JournalFailureNotice() {
  const failure = useJournalFailure();

  if (failure === null) {
    return null;
  }

  // the worker stamps the server's cursor onto the failure itself, so the line is right on a tab
  // that never saw a save report
  const receivedLine =
    failure.receivedVersion === null || failure.receivedVersion === 0
      ? 'The server has not received any of this run yet.'
      : `The server has received this run up to save ${failure.receivedVersion}.`;

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
