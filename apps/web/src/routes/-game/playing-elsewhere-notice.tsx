import { Dialog, Text } from '@vers/design-system';
import { setWriterDisplacedActivityID, useWriterDisplacedActivityID } from '@vers/idle-client';

/**
 * The terminal notice shown when another device has taken over this avatar's run. This device's
 * simulation has stopped and nothing it submits will persist, so the notice only informs the
 * player — it offers no way to take the run back. Closing it clears this tab's copy of the
 * displaced state; the notice reopens only if the run is taken over again.
 */
export function PlayingElsewhereNotice() {
  const displacedActivityID = useWriterDisplacedActivityID();

  if (displacedActivityID === null) {
    return null;
  }

  return (
    <Dialog
      onOpenChange={(open) => {
        if (!open) {
          setWriterDisplacedActivityID(null);
        }
      }}
      open
      title="Playing on another device"
    >
      <Text>Your run has been picked up on another device.</Text>
    </Dialog>
  );
}
