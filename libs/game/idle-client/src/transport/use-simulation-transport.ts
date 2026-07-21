import { useEffect } from 'react';
import { advanceWriterGeneration } from '../state/advance-writer-generation';
import { setCheckpointFlushStall } from '../state/set-checkpoint-flush-stall';
import { setCheckpointStreamError } from '../state/set-checkpoint-stream-error';
import { setConnectionStatus } from '../state/set-connection-status';
import { setFailureAction } from '../state/set-failure-action';
import { setLastCompletedActivityID } from '../state/set-last-completed-activity-id';
import { setOfflineCapStatus } from '../state/set-offline-cap-status';
import { setResyncStatus } from '../state/set-resync-status';
import { setRewardSlotLedger } from '../state/set-reward-slot-ledger';
import { setSimulationInitialized } from '../state/set-simulation-initialized';
import { setSimulationSnapshot } from '../state/set-simulation-snapshot';
import { setSimulationTransport } from '../state/set-simulation-transport';
import { setStartReport } from '../state/set-start-report';
import { setWriterDisplacedActivityID } from '../state/set-writer-displaced-activity-id';
import { updateRewardSlotLedger } from '../state/update-reward-slot-ledger';
import { useIdleStore } from '../state/use-idle-store';
import { WorkerMessageType } from '../types';
import type { WorkerMessage } from '../worker/worker-to-client-message-schema';
import { createChannelTransport } from './create-channel-transport';
import { createSharedWorkerTransport } from './create-shared-worker-transport';
import { isWebLocksSupported } from './is-web-locks-supported';
import { pickTransportKind } from './pick-transport-kind';

export function useSimulationTransport() {
  const existingTransport = useIdleStore((state) => state.transport);

  useEffect(() => {
    // read the store imperatively, not the render closure: sibling consumers mount in one commit,
    // and a store write during the effect flush does not re-render them before their own queued
    // effects run — each would see a stale null and construct its own transport (and, on the
    // fallback path, its own election worker). The imperative read also absorbs StrictMode's
    // double-invoke, since the first run commits to the store synchronously.
    if (useIdleStore.getState().transport !== null) {
      return;
    }

    const kind = pickTransportKind({
      hasSharedWorker: typeof SharedWorker !== 'undefined',
      hasWebLocks: isWebLocksSupported(),
    });

    if (kind === 'none') {
      return;
    }

    const transport =
      kind === 'shared-worker' ? createSharedWorkerTransport() : createChannelTransport();

    // a page-lifetime subscription: the transport lives in the store until the page dies, so
    // nothing ever detaches it
    transport.subscribe(handleWorkerMessage);

    setSimulationTransport(transport);
  }, [existingTransport]);

  return existingTransport;
}

function handleWorkerMessage(message: WorkerMessage) {
  switch (message.type) {
    case WorkerMessageType.InitialState: {
      setSimulationInitialized(true);
      setSimulationSnapshot(message.state);
      setRewardSlotLedger(message.rewardSlotLedger);
      setWriterDisplacedActivityID(message.writerDisplacedActivityID);
      break;
    }

    case WorkerMessageType.SimulationUpdate: {
      setSimulationSnapshot(message.state);
      break;
    }

    case WorkerMessageType.ActivityCompleted: {
      setLastCompletedActivityID(message.activityID);
      break;
    }

    case WorkerMessageType.CheckpointFlushStalled: {
      setCheckpointFlushStall({
        activityID: message.activityID,
        reason: message.reason,
        traceID: message.traceID,
      });

      break;
    }

    case WorkerMessageType.CheckpointStreamInvalid: {
      setCheckpointStreamError({
        activityID: message.activityID,
        reason: message.reason,
        ...(message.traceID === undefined ? {} : { traceID: message.traceID }),
      });

      break;
    }

    case WorkerMessageType.OfflineCapStatus: {
      setOfflineCapStatus({
        halted: message.halted,
        remainingMs: message.remainingMs,
      });

      break;
    }

    case WorkerMessageType.ResyncStatus: {
      setResyncStatus(message.status);
      break;
    }

    case WorkerMessageType.ConnectionStatus: {
      setConnectionStatus(message.online);
      break;
    }

    case WorkerMessageType.FailureActionStatus: {
      setFailureAction(message.failureAction);
      break;
    }

    case WorkerMessageType.RewardSlotsRecorded: {
      updateRewardSlotLedger({
        activityID: message.activityID,
        count: message.rewardSlotCount,
        version: message.version,
      });

      break;
    }

    case WorkerMessageType.StartStatus: {
      setStartReport({ requestID: message.requestID, status: message.status });
      break;
    }

    case WorkerMessageType.WriterDisplaced: {
      setWriterDisplacedActivityID(message.activityID);
      break;
    }

    case WorkerMessageType.WriterReady: {
      advanceWriterGeneration();
      break;
    }
  }
}
