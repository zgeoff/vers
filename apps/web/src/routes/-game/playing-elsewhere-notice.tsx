import { useQuery } from '@tanstack/react-query';
import { Button, Dialog, Text } from '@vers/design-system';
import { useWriterDisplacedActivityID } from '@vers/idle-client';
import { useState } from 'react';
import { buildActiveAvatarQueryOptions } from '../../lib/avatar/build-active-avatar-query-options';
import { sendIdleRequestResync } from '../../lib/idle/send-idle-request-resync';
import { useIdleWorkerHandle } from '../../lib/idle/use-idle-worker-handle';

/**
 * Tells the player their run is being played on another device: this device's simulation stopped
 * and nothing it submits persists. "Continue here" claims the run back through a claiming resync;
 * dismissing leaves the run to the other device. Dismissal is per displaced activity, so a later
 * displacement (or the same run displaced again after a take-back) re-opens it, while the
 * worker's transition-only broadcast keeps reconnect churn from re-raising a dismissed notice.
 */
export function PlayingElsewhereNotice() {
  const displacedActivityID = useWriterDisplacedActivityID();
  const idleWorkerHandle = useIdleWorkerHandle();
  const avatarQuery = useQuery(buildActiveAvatarQueryOptions());
  const [dismissedActivityID, setDismissedActivityID] = useState<null | string>(null);
  const avatarID = avatarQuery.data?.id;

  if (displacedActivityID === null || displacedActivityID === dismissedActivityID) {
    return null;
  }

  return (
    <Dialog
      onOpenChange={(open) => {
        if (!open) {
          setDismissedActivityID(displacedActivityID);
        }
      }}
      open
      title="Playing on another device"
    >
      <Text>
        Your run picked up on another device, so it&rsquo;s paused here. Everything you earn over
        there is saved.
      </Text>
      <Button
        onClick={() => {
          if (idleWorkerHandle.worker !== undefined && avatarID !== undefined) {
            sendIdleRequestResync(idleWorkerHandle.worker, avatarID, true);
          }

          setDismissedActivityID(displacedActivityID);
        }}
      >
        Continue here
      </Button>
    </Dialog>
  );
}
