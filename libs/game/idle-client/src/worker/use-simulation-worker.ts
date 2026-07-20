import { useEffect } from 'react';
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
import { setSimulationWorker } from '../state/set-simulation-worker';
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
} from '../types';
import { WorkerMessageType } from '../types';
import { createDisconnectMessage } from './create-disconnect-message';

let hasRegisteredDisconnectListener = false;

export function useSimulationWorker() {
  const existingWorker = useIdleStore((state) => state.worker);

  useEffect(() => {
    // Browsers without SharedWorker (Android Chrome, older Safari) would throw on construction;
    // the worker stays undefined and every consumer degrades to its no-worker branch.
    if (typeof SharedWorker === 'undefined') {
      return;
    }

    const worker =
      existingWorker ??
      // oxlint-disable-next-line unicorn/relative-url-style -- Vite's worker-import-meta-url plugin resolves this specifier as a relative file reference only with the leading './'; a bare specifier resolves to the same URL at runtime but Vite's static analysis would treat it as a bare package import and skip bundling it
      new SharedWorker(new URL('./worker.ts', import.meta.url), { type: 'module' });

    setSimulationWorker(worker);

    // oxlint-disable-next-line unicorn/prefer-add-event-listener -- assigning onmessage starts MessagePort delivery; addEventListener also needs an explicit port.start()
    worker.port.onmessage = handleWorkerMessage;

    // Registered once for the page's lifetime, never from this effect's own cleanup: the effect's
    // `[existingWorker]` dependency re-runs right after the first mount creates a worker (the store
    // update it triggers changes `existingWorker`'s identity), and a cleanup-based send would fire
    // on that transition and disconnect the connection it just made.
    if (!hasRegisteredDisconnectListener) {
      hasRegisteredDisconnectListener = true;

      window.addEventListener('pagehide', handlePageHide);
    }
  }, [existingWorker]);

  return existingWorker;
}

function handlePageHide() {
  const worker = useIdleStore.getState().worker;

  worker?.port.postMessage(createDisconnectMessage());
}

function handleWorkerMessage(event: MessageEvent<WorkerMessage>) {
  if (isInitialStateMessage(event.data)) {
    setSimulationInitialized(true);
  }

  if (isInitialStateMessage(event.data) || isUpdateMessage(event.data)) {
    setSimulationSnapshot(event.data.state);
  }

  if (isInitialStateMessage(event.data)) {
    setRewardSlotLedger(event.data.rewardSlotLedger);
  }

  if (isActivityCompletedMessage(event.data)) {
    setLastCompletedActivityID(event.data.activityID);
  }

  if (isCheckpointFlushStalledMessage(event.data)) {
    setCheckpointFlushStall({
      activityID: event.data.activityID,
      reason: event.data.reason,
      traceID: event.data.traceID,
    });
  }

  if (isCheckpointStreamInvalidMessage(event.data)) {
    setCheckpointStreamError({
      activityID: event.data.activityID,
      reason: event.data.reason,
      ...(event.data.traceID === undefined ? {} : { traceID: event.data.traceID }),
    });
  }

  if (isOfflineCapStatusMessage(event.data)) {
    setOfflineCapStatus({
      halted: event.data.halted,
      remainingMs: event.data.remainingMs,
    });
  }

  if (isResyncStatusMessage(event.data)) {
    setResyncStatus(event.data.status);
  }

  if (isConnectionStatusMessage(event.data)) {
    setConnectionStatus(event.data.online);
  }

  if (isFailureActionStatusMessage(event.data)) {
    setFailureAction(event.data.failureAction);
  }

  if (isRewardSlotsRecordedMessage(event.data)) {
    updateRewardSlotLedger({
      activityID: event.data.activityID,
      count: event.data.rewardSlotCount,
      version: event.data.version,
    });
  }

  if (isStartStatusMessage(event.data)) {
    setStartReport({ requestID: event.data.requestID, status: event.data.status });
  }

  if (isInitialStateMessage(event.data)) {
    setWriterDisplacedActivityID(event.data.writerDisplacedActivityID);
  }

  if (isWriterDisplacedMessage(event.data)) {
    setWriterDisplacedActivityID(event.data.activityID);
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
