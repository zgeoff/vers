import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useResyncStatus, useWriterGeneration } from '@vers/idle-client';
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
const INITIALIZE_RETRY_MS = 1000;

/**
 * A side-effect-only sibling to the game layout's outlet; renders nothing.
 */
export function GameSimulationMount() {
  const idleWorkerHandle = useIdleWorkerHandle();
  const queryClient = useQueryClient();
  const avatarQuery = useQuery(buildActiveAvatarQueryOptions());
  const resyncStatus = useResyncStatus();
  const writerGeneration = useWriterGeneration();
  const avatarID = avatarQuery.data?.id;
  const lastReportedGeneration = useRef<number | undefined>(undefined);
  const lastWorkerActivityID = useRef(idleWorkerHandle.activity?.id);

  // send-and-retry until the worker answers with its initial state: on the fallback transport a
  // post can land while no writer holds the lock (first load, a join mid-election, a succession
  // gap) and is silently lost, and a writer promotion resets `initialized` to re-enter this loop
  useEffect(() => {
    const transport = idleWorkerHandle.transport;
    const needsHandshake = transport !== undefined && !idleWorkerHandle.initialized;

    const timer = needsHandshake
      ? setInterval(() => {
          sendIdleInitialize(transport);
        }, INITIALIZE_RETRY_MS)
      : undefined;

    if (needsHandshake) {
      sendIdleInitialize(transport);
    }

    return () => {
      if (timer !== undefined) {
        clearInterval(timer);
      }
    };
  }, [idleWorkerHandle.transport, idleWorkerHandle.initialized]);

  // reports once per writer generation, only once the worker has reported its initial state and
  // an active avatar is known — a connectivity signal, not a resync command: the worker decides
  // whether a catch-up follows, and an activity started fresh goes through SetActivity
  useEffect(() => {
    if (
      idleWorkerHandle.transport === undefined ||
      !idleWorkerHandle.initialized ||
      avatarID === undefined ||
      lastReportedGeneration.current === writerGeneration
    ) {
      return;
    }

    // this mount's first report claims — a mount is the player arriving in the game (a page load
    // or a deliberate navigation back), so a catch-up the worker schedules may take an active
    // run's writer. A succession re-report while mounted is automatic and must never claim: a
    // dying background tab's promotion would otherwise steal the writer from a device the player
    // is actively driving.
    const claim = lastReportedGeneration.current === undefined;

    lastReportedGeneration.current = writerGeneration;

    sendIdleReportOnline(idleWorkerHandle.transport, avatarID, claim);
  }, [idleWorkerHandle.transport, idleWorkerHandle.initialized, avatarID, writerGeneration]);

  // fires once per page load under the same gate as the resync: a live worker and a known avatar
  // is the point the player is actually in the game
  useEffect(() => {
    if (
      idleWorkerHandle.transport === undefined ||
      !idleWorkerHandle.initialized ||
      avatarID === undefined ||
      hasSentSessionStart
    ) {
      return;
    }

    hasSentSessionStart = true;

    emitProductEvent('session_started', {});
  }, [idleWorkerHandle.transport, idleWorkerHandle.initialized, avatarID]);

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
    const transport = idleWorkerHandle.transport;

    const handleOnline = () => {
      // an automatic reconnect never claims the writer — the run may be live on another device
      if (transport !== undefined && avatarID !== undefined) {
        sendIdleReportOnline(transport, avatarID, false);
      }
    };

    globalThis.addEventListener('online', handleOnline);

    return () => {
      globalThis.removeEventListener('online', handleOnline);
    };
  }, [idleWorkerHandle.transport, avatarID]);

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
