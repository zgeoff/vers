import { Dialog, Text } from '@vers/design-system';
import { setWriterDisplacedActivityID, useWriterDisplacedActivityID } from '@vers/idle-client';

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
