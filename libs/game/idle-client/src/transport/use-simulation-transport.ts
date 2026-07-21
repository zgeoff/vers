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
import type {
  ActivityCompletedMessage,
  CheckpointFlushStalledMessage,
  CheckpointStreamInvalidMessage,
  ConnectionStatusMessage,
  FailureActionStatusMessage,
  InitialStateMessage,
  OfflineCapStatusMessage,
  ResyncStatusMessage,
  RewardSlotsRecordedMessage,
  SimulationUpdateMessage,
  StartStatusMessage,
  WorkerMessage,
  WriterDisplacedMessage,
  WriterReadyMessage,
} from '../types';
import { WorkerMessageType } from '../types';
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
  if (isInitialStateMessage(message)) {
    setSimulationInitialized(true);
  }

  if (isInitialStateMessage(message) || isUpdateMessage(message)) {
    setSimulationSnapshot(message.state);
  }

  if (isInitialStateMessage(message)) {
    setRewardSlotLedger(message.rewardSlotLedger);
  }

  if (isActivityCompletedMessage(message)) {
    setLastCompletedActivityID(message.activityID);
  }

  if (isCheckpointFlushStalledMessage(message)) {
    setCheckpointFlushStall({
      activityID: message.activityID,
      reason: message.reason,
      traceID: message.traceID,
    });
  }

  if (isCheckpointStreamInvalidMessage(message)) {
    setCheckpointStreamError({
      activityID: message.activityID,
      reason: message.reason,
      ...(message.traceID === undefined ? {} : { traceID: message.traceID }),
    });
  }

  if (isOfflineCapStatusMessage(message)) {
    setOfflineCapStatus({
      halted: message.halted,
      remainingMs: message.remainingMs,
    });
  }

  if (isResyncStatusMessage(message)) {
    setResyncStatus(message.status);
  }

  if (isConnectionStatusMessage(message)) {
    setConnectionStatus(message.online);
  }

  if (isFailureActionStatusMessage(message)) {
    setFailureAction(message.failureAction);
  }

  if (isRewardSlotsRecordedMessage(message)) {
    updateRewardSlotLedger({
      activityID: message.activityID,
      count: message.rewardSlotCount,
      version: message.version,
    });
  }

  if (isStartStatusMessage(message)) {
    setStartReport({ requestID: message.requestID, status: message.status });
  }

  if (isInitialStateMessage(message)) {
    setWriterDisplacedActivityID(message.writerDisplacedActivityID);
  }

  if (isWriterDisplacedMessage(message)) {
    setWriterDisplacedActivityID(message.activityID);
  }

  if (isWriterReadyMessage(message)) {
    advanceWriterGeneration();
  }
}

function isInitialStateMessage(message: WorkerMessage): message is InitialStateMessage {
  return message.type === WorkerMessageType.InitialState;
}

function isUpdateMessage(message: WorkerMessage): message is SimulationUpdateMessage {
  return message.type === WorkerMessageType.SimulationUpdate;
}

function isActivityCompletedMessage(message: WorkerMessage): message is ActivityCompletedMessage {
  return message.type === WorkerMessageType.ActivityCompleted;
}

function isCheckpointFlushStalledMessage(
  message: WorkerMessage,
): message is CheckpointFlushStalledMessage {
  return message.type === WorkerMessageType.CheckpointFlushStalled;
}

function isCheckpointStreamInvalidMessage(
  message: WorkerMessage,
): message is CheckpointStreamInvalidMessage {
  return message.type === WorkerMessageType.CheckpointStreamInvalid;
}

function isOfflineCapStatusMessage(message: WorkerMessage): message is OfflineCapStatusMessage {
  return message.type === WorkerMessageType.OfflineCapStatus;
}

function isResyncStatusMessage(message: WorkerMessage): message is ResyncStatusMessage {
  return message.type === WorkerMessageType.ResyncStatus;
}

function isConnectionStatusMessage(message: WorkerMessage): message is ConnectionStatusMessage {
  return message.type === WorkerMessageType.ConnectionStatus;
}

function isFailureActionStatusMessage(
  message: WorkerMessage,
): message is FailureActionStatusMessage {
  return message.type === WorkerMessageType.FailureActionStatus;
}

function isRewardSlotsRecordedMessage(
  message: WorkerMessage,
): message is RewardSlotsRecordedMessage {
  return message.type === WorkerMessageType.RewardSlotsRecorded;
}

function isStartStatusMessage(message: WorkerMessage): message is StartStatusMessage {
  return message.type === WorkerMessageType.StartStatus;
}

function isWriterDisplacedMessage(message: WorkerMessage): message is WriterDisplacedMessage {
  return message.type === WorkerMessageType.WriterDisplaced;
}

function isWriterReadyMessage(message: WorkerMessage): message is WriterReadyMessage {
  return message.type === WorkerMessageType.WriterReady;
}
