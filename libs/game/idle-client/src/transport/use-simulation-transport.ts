import { useEffect } from 'react';
import { advanceWriterGeneration } from '../state/advance-writer-generation';
import { setCheckpointStreamError } from '../state/set-checkpoint-stream-error';
import { setFailureAction } from '../state/set-failure-action';
import { setLastCompletedActivityID } from '../state/set-last-completed-activity-id';
import { setOfflineCapStatus } from '../state/set-offline-cap-status';
import { setResyncStatus } from '../state/set-resync-status';
import { setSimulationSnapshot } from '../state/set-simulation-snapshot';
import { setWorkerClient } from '../state/set-worker-client';
import { setWriterDisplacedActivityID } from '../state/set-writer-displaced-activity-id';
import { updateRewardSlotLedger } from '../state/update-reward-slot-ledger';
import { useIdleStore } from '../state/use-idle-store';
import { WorkerMessageType } from '../types';
import type { WorkerMessage } from '../worker/worker-to-client-message-schema';
import { workerToClientMessageSchema } from '../worker/worker-to-client-message-schema';
import { WORKER_TO_CLIENT_CHANNEL } from './constants';
import { createSharedWorkerClient } from './create-shared-worker-client';
import { createWebLocksClient } from './create-web-locks-client';
import { isWebLocksSupported } from './is-web-locks-supported';
import { pickTransportKind } from './pick-transport-kind';

export function useSimulationTransport() {
  const existingClient = useIdleStore((state) => state.client);

  useEffect(() => {
    // read the store imperatively, not the render closure: sibling consumers mount in one commit,
    // and a store write during the effect flush does not re-render them before their own queued
    // effects run — each would see a stale null and construct its own client (and, on the
    // fallback path, its own election worker). The imperative read also absorbs StrictMode's
    // double-invoke, since the first run commits to the store synchronously.
    if (useIdleStore.getState().client !== null) {
      return;
    }

    const kind = pickTransportKind({
      hasSharedWorker: typeof SharedWorker !== 'undefined',
      hasWebLocks: isWebLocksSupported(),
    });

    if (kind === 'none') {
      return;
    }

    const client = kind === 'shared-worker' ? createSharedWorkerClient() : createWebLocksClient();

    setWorkerClient(client);
  }, [existingClient]);

  // every mounted consumer keeps its own subscription: broadcasts apply idempotent state writes,
  // so redundant delivery across sibling consumers costs nothing, and cleaning up on unmount keeps
  // a consumer that unmounts and remounts (a route transition away from and back to the game
  // shell) from accumulating stale listeners
  useEffect(() => {
    const channel = new BroadcastChannel(WORKER_TO_CLIENT_CHANNEL);

    channel.addEventListener('message', (event: MessageEvent<unknown>) => {
      handleWorkerMessage(workerToClientMessageSchema.parse(event.data));
    });

    return () => {
      channel.close();
    };
  }, []);

  return existingClient;
}

function handleWorkerMessage(message: WorkerMessage) {
  switch (message.type) {
    case WorkerMessageType.SimulationUpdate: {
      setSimulationSnapshot(message.state);
      break;
    }

    case WorkerMessageType.ActivityCompleted: {
      setLastCompletedActivityID(message.activityID);
      break;
    }

    case WorkerMessageType.CheckpointStreamInvalid: {
      setCheckpointStreamError({ activityID: message.activityID });
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
