import { useEffect } from 'react';
import { match } from 'ts-pattern';
import { addResyncSettledAvatarID } from '../state/add-resync-settled-avatar-id';
import { advanceWriterGeneration } from '../state/advance-writer-generation';
import { setCheckpointStreamError } from '../state/set-checkpoint-stream-error';
import { setFailureAction } from '../state/set-failure-action';
import { setJournalFailure } from '../state/set-journal-failure';
import { setLastIngestedActivityID } from '../state/set-last-ingested-activity-id';
import { setOfflineCapStatus } from '../state/set-offline-cap-status';
import { setResyncStatus } from '../state/set-resync-status';
import { setRunOutcome } from '../state/set-run-outcome';
import { setSimulationSnapshot } from '../state/set-simulation-snapshot';
import { setSimulationSpeed } from '../state/set-simulation-speed';
import { setWorkerClient } from '../state/set-worker-client';
import { setWriterContention } from '../state/set-writer-contention';
import { setWriterDisplacedActivityID } from '../state/set-writer-displaced-activity-id';
import { updateRewardSlotLedger } from '../state/update-reward-slot-ledger';
import { updateSaveStatus } from '../state/update-save-status';
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
    // read the store imperatively: sibling consumers mount in one commit, and a store write during
    // the effect flush does not re-render them before their own effects run, so each would see a
    // stale null and build its own client; the read also absorbs StrictMode's double-invoke
    if (existingClient !== null || useIdleStore.getState().client !== null) {
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

  useEffect(() => {
    subscribeToWorkerBroadcasts();

    return () => {
      unsubscribeFromWorkerBroadcasts();
    };
  }, []);

  return existingClient;
}

let broadcastChannel: BroadcastChannel | null = null;
let broadcastSubscriberCount = 0;

// one listener however many consumers mount: the reward-ledger and writer-generation writers
// append and increment rather than assign, so a second listener double-applies every broadcast
function subscribeToWorkerBroadcasts() {
  broadcastSubscriberCount += 1;

  if (broadcastChannel !== null) {
    return;
  }

  broadcastChannel = new BroadcastChannel(WORKER_TO_CLIENT_CHANNEL);

  broadcastChannel.addEventListener('message', (event: MessageEvent<unknown>) => {
    handleWorkerMessage(workerToClientMessageSchema.parse(event.data));
  });
}

function handleWorkerMessage(message: WorkerMessage) {
  match(message)
    .with({ type: WorkerMessageType.SimulationUpdate }, (received) => {
      setSimulationSnapshot(received.state, received.liveRun);
    })
    .with({ type: WorkerMessageType.ActivityEnded }, (received) => {
      setRunOutcome(received.outcome);
    })
    .with({ type: WorkerMessageType.ActivityStartIngested }, (received) => {
      setLastIngestedActivityID(received.activityID);
    })
    .with({ type: WorkerMessageType.CheckpointStreamInvalid }, (received) => {
      setCheckpointStreamError({ activityID: received.activityID });
    })
    .with({ type: WorkerMessageType.JournalFailure }, (received) => {
      setJournalFailure({
        activityID: received.activityID,
        kind: received.kind,
        receivedVersion: received.receivedVersion,
      });
    })
    .with({ type: WorkerMessageType.SaveStatus }, (received) => {
      updateSaveStatus({
        activityID: received.activityID,
        receivedVersion: received.receivedVersion,
        savedVersion: received.savedVersion,
      });
    })
    .with({ type: WorkerMessageType.OfflineCapStatus }, (received) => {
      setOfflineCapStatus({
        halted: received.halted,
        remainingMs: received.remainingMs,
      });
    })
    .with({ type: WorkerMessageType.ResyncSettled }, (received) => {
      // the run the resync installed lands before the settled mark, so no render sees a settled
      // resync without it
      setSimulationSnapshot(received.state, received.liveRun);
      addResyncSettledAvatarID(received.avatarID);
    })
    .with({ type: WorkerMessageType.ResyncStatus }, (received) => {
      setResyncStatus(received.status);
    })
    .with({ type: WorkerMessageType.FailureActionStatus }, (received) => {
      setFailureAction(received.failureAction);
    })
    .with({ type: WorkerMessageType.SimulationSpeedStatus }, (received) => {
      setSimulationSpeed(received.speed);
    })
    .with({ type: WorkerMessageType.RewardSlotsRecorded }, (received) => {
      updateRewardSlotLedger({
        activityID: received.activityID,
        count: received.rewardSlotCount,
        version: received.version,
      });
    })
    .with({ type: WorkerMessageType.WriterDisplaced }, (received) => {
      setWriterDisplacedActivityID(received.activityID);
    })
    .with({ type: WorkerMessageType.WriterPending }, () => {
      setWriterContention(true);
    })
    .with({ type: WorkerMessageType.WriterReady }, () => {
      setWriterContention(false);
      advanceWriterGeneration();
    })
    .exhaustive();
}

function unsubscribeFromWorkerBroadcasts() {
  broadcastSubscriberCount -= 1;

  if (broadcastSubscriberCount > 0 || broadcastChannel === null) {
    return;
  }

  broadcastChannel.close();

  broadcastChannel = null;
}
