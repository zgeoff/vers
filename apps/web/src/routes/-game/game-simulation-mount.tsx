import * as Sentry from '@sentry/react';
import { useEffect } from 'react';
import { sendIdleInitialize } from '../../lib/idle/send-idle-initialize';
import { useIdleWorkerHandle } from '../../lib/idle/use-idle-worker-handle';

/**
 * Renders nothing: a side-effect-only sibling to the game layout's outlet, so it returns null by
 * design.
 */
export function GameSimulationMount() {
  const idleWorkerHandle = useIdleWorkerHandle();

  useEffect(() => {
    if (idleWorkerHandle.worker !== undefined && !idleWorkerHandle.initialized) {
      sendIdleInitialize(idleWorkerHandle.worker);
    }
  }, [idleWorkerHandle.worker, idleWorkerHandle.initialized]);

  useEffect(() => {
    if (idleWorkerHandle.checkpointStreamError === undefined) {
      return;
    }

    Sentry.captureException(
      new Error(
        `checkpoint stream rejected for activity ${idleWorkerHandle.checkpointStreamError.activityID}: ${idleWorkerHandle.checkpointStreamError.reason}`,
      ),
    );
  }, [idleWorkerHandle.checkpointStreamError]);

  return null;
}
