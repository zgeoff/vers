import type { ActivityData } from '@vers/contract-activity';
import { OFFLINE_PROGRESS_CAP_MS } from '@vers/contract-activity';
import type { Simulation } from '@vers/idle-core';
import { SIMULATION_TIMESTEP_MS } from '@vers/idle-core';
import invariant from 'tiny-invariant';
import { createActivityServiceClient } from '../submission/create-activity-service-client';
import { createCheckpointSubmitter } from '../submission/create-checkpoint-submitter';
import type { ClientMessage, RewardSlotLedgerEntry, WorkerMessage } from '../types';
import { createCheckpointStreamInvalidMessage } from './create-checkpoint-stream-invalid-message';
import { createConnectionStatusMessage } from './create-connection-status-message';
import { createOfflineCapStatusMessage } from './create-offline-cap-status-message';
import { createRequestResyncMessage } from './create-request-resync-message';
import { handleClientMessage } from './handle-client-message';
import { handleRequestResyncMessage } from './handle-request-resync-message';
import { runSimulation } from './run-simulation';
import type { WorkerContext } from './types';

export interface WorkerRuntime {
  readonly connections: ReadonlySet<MessagePort>;
  readonly handleConnect: (event: MessageEvent) => void;
  readonly stop: () => void;
}

interface CreateWorkerRuntimeOptions {
  readonly timestep?: number;
}

/**
 * Owns one worker process's connections, simulation, and fixed-timestep tick loop. Production
 * wiring (`worker.ts`) constructs exactly one runtime per worker, holding the
 * one-simulation-per-worker invariant.
 */
export function createWorkerRuntime(options: CreateWorkerRuntimeOptions = {}): WorkerRuntime {
  const timestep = options.timestep ?? SIMULATION_TIMESTEP_MS;

  const connections = new Set<MessagePort>();

  const client = createActivityServiceClient();
  let simulation: null | Simulation = null;
  let activity: ActivityData | null = null;
  let running = false;
  let stopped = false;
  let lastFrameTime = performance.now();
  let accumulator = 0;
  let resyncAvatarID: string | null = null;
  let resyncInFlight = false;

  // A fresh worker starts fully funded and drains toward the cap until its first acknowledged
  // submission; every ack re-anchors the budget at the cap.
  let lastAckAt = Date.now();
  let rewardSlotLedgerActivityID: null | string = null;
  let rewardSlotLedger: ReadonlyArray<RewardSlotLedgerEntry> = [];

  const emitWorkerMessage = (message: WorkerMessage) => {
    for (const connection of connections) {
      connection.postMessage(message);
    }
  };

  const emitConnectionStatus = (online: boolean) => {
    emitWorkerMessage(createConnectionStatusMessage(online));
  };

  const submitter = createCheckpointSubmitter({
    client,
    onAcked: () => {
      lastAckAt = Date.now();
    },
    onCapped: () => {
      emitWorkerMessage(createOfflineCapStatusMessage(0, true));
    },
    onHeld: () => {
      emitConnectionStatus(false);
    },
    onInvalid: (activityID, reason) => {
      emitWorkerMessage(createCheckpointStreamInvalidMessage(activityID, reason));
    },
  });

  const context: WorkerContext = {
    connections,
    getActivity: () => activity,
    getClient: () => client,
    getRemainingBudgetMs: () => OFFLINE_PROGRESS_CAP_MS - (Date.now() - lastAckAt),
    getResyncAvatarID: () => resyncAvatarID,
    getRewardSlotLedger: () => ({
      activityID: rewardSlotLedgerActivityID,
      entries: rewardSlotLedger,
    }),
    getSimulation: () => simulation,
    getSubmitter: () => submitter,
    isResyncInFlight: () => resyncInFlight,
    recordRewardSlots: (activityID, entry) => {
      if (rewardSlotLedgerActivityID === activityID) {
        rewardSlotLedger = [...rewardSlotLedger, entry];

        return;
      }

      rewardSlotLedgerActivityID = activityID;
      rewardSlotLedger = [entry];
    },
    removeConnection: (port) => {
      connections.delete(port);
    },
    setActivity: (newActivity) => {
      activity = newActivity;
    },
    setResyncAvatarID: (avatarID) => {
      resyncAvatarID = avatarID;
    },
    setResyncInFlight: (inFlight) => {
      resyncInFlight = inFlight;
    },
    setSimulation: (newSimulation) => {
      simulation = newSimulation;
    },
  };

  // standard shared worker setup - cache our listeners so we can message them later
  const handleConnect = (event: MessageEvent) => {
    const [port] = event.ports;

    invariant(port, 'port is required');

    connections.add(port);
    port.start();

    port.addEventListener('message', (messageEvent: MessageEvent<ClientMessage>) => {
      void handleClientMessage(context, port, messageEvent);
    });

    // Chrome fires 'close' when the peer disconnects (shipped 2024); Firefox/Safari support is
    // unconfirmed and Bun fires no 'close' event at all, so this leg runs untested in every test
    // suite — the explicit Disconnect message handled above is the reliable path.
    port.addEventListener('close', () => {
      connections.delete(port);
    });

    // ensure we're only running one loop per worker
    if (!running) {
      running = true;
      void runTickLoop();
    }
  };

  // our main loop function uses a fixed timestep to ensure consistent updates as
  // we're not directly tied to UI updates nor do we have access to requestAnimationFrame
  const runTickLoop = async () => {
    if (stopped) {
      return;
    }

    const now = performance.now();
    const frameTime = now - lastFrameTime;

    accumulator += frameTime;

    while (accumulator >= timestep) {
      accumulator -= timestep;

      const currentSimulation = context.getSimulation();

      if (currentSimulation) {
        await runSimulation(context, currentSimulation, timestep);
      }
    }

    lastFrameTime = now;

    await wait(1);

    void runTickLoop();
  };

  // The worker's own reconnect recovery: a returning connection resends whatever the submitter
  // held, then — once the held tail is drained, so a resync never reads a stale appended head —
  // self-triggers a resync when nothing is live to catch up an avatar it remembers.
  const handleOnline = () => {
    emitConnectionStatus(true);

    void (async () => {
      await submitter.flushHeld();

      if (context.getSimulation() === null && resyncAvatarID !== null) {
        await handleRequestResyncMessage(context, createRequestResyncMessage(resyncAvatarID));
      }
    })();
  };

  const handleOffline = () => {
    emitConnectionStatus(false);
  };

  self.addEventListener('online', handleOnline);
  self.addEventListener('offline', handleOffline);

  const stop = () => {
    stopped = true;

    self.removeEventListener('online', handleOnline);
    self.removeEventListener('offline', handleOffline);
  };

  return { connections, handleConnect, stop };
}

function wait(ms: number) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}
