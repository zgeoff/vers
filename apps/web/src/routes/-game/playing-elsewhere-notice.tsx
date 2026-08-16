import { Dialog, Text } from '@vers/design-system';
import { setWriterDisplacedActivityID, useWriterDisplacedActivityID } from '@vers/idle-client';

/**
 * Tells the player their run has been picked up on another device: this device's simulation
 * stopped and nothing it submits persists. The notice is terminal — there is no in-app way to
 * take the run back; dismissing it only clears the tab's displaced state, which the worker keeps
 * its own record of. The worker's transition-only broadcast never re-raises an unchanged
 * displacement, but a fresh one (the same run displaced again after the player signs back in)
 * transitions through null and re-opens the notice.
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
