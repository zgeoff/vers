import { useQuery } from '@tanstack/react-query';
import { Button, Dialog, Text } from '@vers/design-system';
import { setWriterDisplacedActivityID, useWriterDisplacedActivityID } from '@vers/idle-client';
import { buildActiveAvatarQueryOptions } from '../../lib/avatar/build-active-avatar-query-options';
import { runIgnoringRejection } from '../../lib/idle/run-ignoring-rejection';
import { sendIdleReportOnline } from '../../lib/idle/send-idle-report-online';
import { useIdleWorkerHandle } from '../../lib/idle/use-idle-worker-handle';

/**
 * Tells the player their run is being played on another device: this device's simulation stopped
 * and nothing it submits persists. "Continue here" claims the run back through a claiming report;
 * dismissing leaves the run to the other device. Both clear the tab's displaced state while the
 * worker keeps its own record, whose transition-only broadcast never re-raises an unchanged
 * displacement — but a fresh one (the same run displaced again after a take-back) transitions
 * through null and re-opens the notice.
 */
export function PlayingElsewhereNotice() {
  const displacedActivityID = useWriterDisplacedActivityID();
  const idleWorkerHandle = useIdleWorkerHandle();
  const avatarQuery = useQuery(buildActiveAvatarQueryOptions());
  const avatarID = avatarQuery.data?.id;

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
      <Text>
        Your run picked up on another device, so it&rsquo;s paused here. Everything you earn over
        there is saved.
      </Text>
      <Button
        onClick={() => {
          // The displaced state clears only once the claim is actually sent — clearing without
          // sending would dismiss the player's one recovery notice with nothing claimed. A click
          // before the worker or avatar id resolves leaves the notice open for the next try.
          if (idleWorkerHandle.client === undefined || avatarID === undefined) {
            return;
          }

          runIgnoringRejection(
            sendIdleReportOnline(
              idleWorkerHandle.client,
              avatarID,
              true,
              idleWorkerHandle.writerAbortSignal,
            ),
          );

          setWriterDisplacedActivityID(null);
        }}
      >
        Continue here
      </Button>
    </Dialog>
  );
}
