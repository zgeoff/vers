import * as Sentry from '@sentry/react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useResyncStatus } from '@vers/idle-client';
import { useEffect, useRef } from 'react';
import { currentActivityQueryOptions } from '../../lib/activity/current-activity-query-options';
import { activeAvatarQueryOptions } from '../../lib/avatar/active-avatar-query-options';
import { sendIdleInitialize } from '../../lib/idle/send-idle-initialize';
import { sendIdleRequestResync } from '../../lib/idle/send-idle-request-resync';
import { useIdleWorkerHandle } from '../../lib/idle/use-idle-worker-handle';

/**
 * Renders nothing: a side-effect-only sibling to the game layout's outlet, so it returns null by
 * design.
 */
export function GameSimulationMount() {
  const idleWorkerHandle = useIdleWorkerHandle();
  const queryClient = useQueryClient();
  const avatarQuery = useQuery(activeAvatarQueryOptions());
  const resyncStatus = useResyncStatus();
  const avatarID = avatarQuery.data?.id;
  const hasSentResync = useRef(false);

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

  // sends once per page load, only once the worker has reported its initial state and an active
  // avatar is known — an activity started fresh goes through SetActivity, never this path
  useEffect(() => {
    if (
      idleWorkerHandle.worker === undefined ||
      !idleWorkerHandle.initialized ||
      avatarID === undefined ||
      hasSentResync.current
    ) {
      return;
    }

    hasSentResync.current = true;

    sendIdleRequestResync(idleWorkerHandle.worker, avatarID);
  }, [idleWorkerHandle.worker, idleWorkerHandle.initialized, avatarID]);

  useEffect(() => {
    const worker = idleWorkerHandle.worker;

    if (worker === undefined || avatarID === undefined) {
      return;
    }

    const handleOnline = () => {
      sendIdleRequestResync(worker, avatarID);
    };

    globalThis.addEventListener('online', handleOnline);

    return () => {
      globalThis.removeEventListener('online', handleOnline);
    };
  }, [idleWorkerHandle.worker, avatarID]);

  // a resync's outcome moves the confirmed head; re-anchoring buildSnapshot means refetching both
  // rows rather than trusting anything the tab computed optimistically
  useEffect(() => {
    if (resyncStatus?.kind !== 'done' && resyncStatus?.kind !== 'capped') {
      return;
    }

    void queryClient.invalidateQueries({ queryKey: activeAvatarQueryOptions().queryKey });

    if (avatarID !== undefined) {
      void queryClient.invalidateQueries({
        queryKey: currentActivityQueryOptions(avatarID).queryKey,
      });
    }
  }, [resyncStatus, avatarID, queryClient]);

  return null;
}
