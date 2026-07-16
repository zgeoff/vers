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
    const streamError = idleWorkerHandle.checkpointStreamError;

    if (streamError === undefined) {
      return;
    }

    Sentry.withScope((scope) => {
      if (streamError.traceID !== undefined) {
        scope.setTag('traceID', streamError.traceID);
      }

      Sentry.captureException(
        new Error(
          `checkpoint stream rejected for activity ${streamError.activityID}: ${streamError.reason}`,
        ),
      );
    });
  }, [idleWorkerHandle.checkpointStreamError]);

  useEffect(() => {
    const flushStall = idleWorkerHandle.checkpointFlushStall;

    if (flushStall === undefined) {
      return;
    }

    Sentry.withScope((scope) => {
      scope.setTag('traceID', flushStall.traceID);

      Sentry.captureException(
        new Error(
          `checkpoint flush stalled for activity ${flushStall.activityID}: ${flushStall.reason}`,
        ),
      );
    });
  }, [idleWorkerHandle.checkpointFlushStall]);

  return null;
}
