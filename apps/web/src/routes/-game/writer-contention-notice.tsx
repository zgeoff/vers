import { Button, Dialog, Text } from '@vers/design-system';
import { useSimulationInitialized, useWriterContention } from '@vers/idle-client';

export function WriterContentionNotice() {
  const contention = useWriterContention();
  const initialized = useSimulationInitialized();

  if (!contention) {
    return null;
  }

  // an initialized tab holds the browser's writer, so the other build waits on it: this tab yields
  // by reloading into the current build; a tab that never initialized is the one waiting, and its
  // reload rejoins the writer once the other version's tabs are gone
  const title = initialized ? 'A newer version is ready' : 'Another version is still running';

  const body = initialized
    ? 'Another version of the game is waiting for this tab. Reload to switch to it.'
    : 'Another version of the game is running in another tab. Close or reload that tab, then reload this one.';

  return (
    <Dialog dismissible={false} open title={title}>
      <Text>{body}</Text>
      <Button
        onClick={() => {
          globalThis.location.reload();
        }}
      >
        Reload
      </Button>
    </Dialog>
  );
}
