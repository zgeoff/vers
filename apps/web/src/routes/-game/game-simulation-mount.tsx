import * as Sentry from '@sentry/react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { setCheckpointFlushStall, useResyncStatus } from '@vers/idle-client';
import { useEffect, useRef } from 'react';
import { buildAvatarProgressionQueryOptions } from '../../lib/activity/build-avatar-progression-query-options';
import { buildCurrentActivityQueryOptions } from '../../lib/activity/build-current-activity-query-options';
import { buildActiveAvatarQueryOptions } from '../../lib/avatar/build-active-avatar-query-options';
import { sendIdleInitialize } from '../../lib/idle/send-idle-initialize';
import { sendIdleReportOnline } from '../../lib/idle/send-idle-report-online';
import { useIdleWorkerHandle } from '../../lib/idle/use-idle-worker-handle';
import { emitProductEvent } from '../../lib/product-events/emit-product-event';

// page-lifetime analytics guards, deliberately outside the component: the game layout unmounts on
// account-screen visits, and remounting must neither repeat a session start nor swallow a
// completion the worker reported while unmounted
let hasSentSessionStart = false;
let lastEmittedCompletionID: string | undefined;

/**
 * A side-effect-only sibling to the game layout's outlet; renders nothing.
 */
export function GameSimulationMount() {
  const idleWorkerHandle = useIdleWorkerHandle();
  const queryClient = useQueryClient();
  const avatarQuery = useQuery(buildActiveAvatarQueryOptions());
  const resyncStatus = useResyncStatus();
  const avatarID = avatarQuery.data?.id;
  const hasSentOnlineReport = useRef(false);
  const lastWorkerActivityID = useRef(idleWorkerHandle.activity?.id);

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

    // consume the one-shot report so a later remount doesn't re-deliver it
    setCheckpointFlushStall(null);
  }, [idleWorkerHandle.checkpointFlushStall]);

  // reports once per page load, only once the worker has reported its initial state and an
  // active avatar is known — a connectivity signal, not a resync command: the worker decides
  // whether a catch-up follows, and an activity started fresh goes through SetActivity
  useEffect(() => {
    if (
      idleWorkerHandle.worker === undefined ||
      !idleWorkerHandle.initialized ||
      avatarID === undefined ||
      hasSentOnlineReport.current
    ) {
      return;
    }

    hasSentOnlineReport.current = true;

    // a page load is a deliberate presence: the player opened the game here, so a catch-up the
    // worker schedules may claim an active run's writer
    sendIdleReportOnline(idleWorkerHandle.worker, avatarID, true);
  }, [idleWorkerHandle.worker, idleWorkerHandle.initialized, avatarID]);

  // fires once per page load under the same gate as the resync: a live worker and a known avatar
  // is the point the player is actually in the game
  useEffect(() => {
    if (
      idleWorkerHandle.worker === undefined ||
      !idleWorkerHandle.initialized ||
      avatarID === undefined ||
      hasSentSessionStart
    ) {
      return;
    }

    hasSentSessionStart = true;

    emitProductEvent('session_started', {});
  }, [idleWorkerHandle.worker, idleWorkerHandle.initialized, avatarID]);

  useEffect(() => {
    const completedActivityID = idleWorkerHandle.lastCompletedActivityID;

    if (completedActivityID === undefined || lastEmittedCompletionID === completedActivityID) {
      return;
    }

    lastEmittedCompletionID = completedActivityID;

    emitProductEvent('activity_completed', { activityID: completedActivityID });
  }, [idleWorkerHandle.lastCompletedActivityID]);

  // the tab relays connectivity to the worker: Chromium never fires online events inside a
  // SharedWorker, so this is the reconnect signal there. The worker's flushes are idempotent and
  // its resync single-flights, so a duplicate relay is harmless
  useEffect(() => {
    const worker = idleWorkerHandle.worker;

    const handleOnline = () => {
      // an automatic reconnect never claims the writer — the run may be live on another device
      if (worker !== undefined && avatarID !== undefined) {
        sendIdleReportOnline(worker, avatarID, false);
      }
    };

    globalThis.addEventListener('online', handleOnline);

    return () => {
      globalThis.removeEventListener('online', handleOnline);
    };
  }, [idleWorkerHandle.worker, avatarID]);

  // a live sim that rolls into a continuation switches activity rows mid-session; the server rows
  // anchor optimistic progression, so any switch (or stop) refetches them
  useEffect(() => {
    const workerActivityID = idleWorkerHandle.activity?.id;

    if (lastWorkerActivityID.current === workerActivityID) {
      return;
    }

    lastWorkerActivityID.current = workerActivityID;
    void queryClient.invalidateQueries({ queryKey: buildActiveAvatarQueryOptions().queryKey });

    if (avatarID !== undefined) {
      void queryClient.invalidateQueries({
        queryKey: buildCurrentActivityQueryOptions(avatarID).queryKey,
      });

      void queryClient.invalidateQueries({
        queryKey: buildAvatarProgressionQueryOptions(avatarID).queryKey,
      });
    }
  }, [idleWorkerHandle.activity?.id, avatarID, queryClient]);

  // a resync's outcome moves the confirmed head; re-anchoring buildSnapshot means refetching both
  // rows rather than trusting anything the tab computed optimistically
  useEffect(() => {
    if (resyncStatus?.kind !== 'done' && resyncStatus?.kind !== 'capped') {
      return;
    }

    void queryClient.invalidateQueries({ queryKey: buildActiveAvatarQueryOptions().queryKey });

    if (avatarID !== undefined) {
      void queryClient.invalidateQueries({
        queryKey: buildCurrentActivityQueryOptions(avatarID).queryKey,
      });

      void queryClient.invalidateQueries({
        queryKey: buildAvatarProgressionQueryOptions(avatarID).queryKey,
      });
    }
  }, [resyncStatus, avatarID, queryClient]);

  return null;
}
