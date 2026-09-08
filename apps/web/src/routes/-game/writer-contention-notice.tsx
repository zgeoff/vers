import { Button, Dialog, Text } from '@vers/design-system';
import { useSimulationInitialized, useWriterContention } from '@vers/idle-client';

export function WriterContentionNotice() {
  const contention = useWriterContention();
  const initialized = useSimulationInitialized();

  if (!contention) {
    return null;
  }

  // an initialized tab holds the browser's writer, so the other build waits on it: this tab yields
  // by reloading into the current build; a tab that never initialized is the one waiting
  if (initialized) {
    return (
      <Dialog open title="A newer version is ready">
        <Text>Another version of the game is waiting for this tab. Reload to switch to it.</Text>
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

  return (
    <Dialog open title="Another version is still running">
      <Text>
        Another version of the game is running in another tab. Close or reload that tab to continue
        here.
      </Text>
    </Dialog>
  );
}
