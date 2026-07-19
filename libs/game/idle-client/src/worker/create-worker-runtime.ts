import type { ActivityData } from '@vers/contract-activity';
import { OFFLINE_PROGRESS_CAP_MS } from '@vers/contract-activity';
import type { Simulation } from '@vers/idle-core';
import { ActivityFailureAction, SIMULATION_TIMESTEP_MS } from '@vers/idle-core';
import invariant from 'tiny-invariant';
import { createActivityServiceClient } from '../submission/create-activity-service-client';
import { createCheckpointSubmitter } from '../submission/create-checkpoint-submitter';
import { readFailureActionCache } from '../submission/read-failure-action-cache';
import type { ActivityServiceClient } from '../submission/types';
import type { ClientMessage, RewardSlotLedgerEntry, WorkerMessage } from '../types';
import { createCheckpointFlushStalledMessage } from './create-checkpoint-flush-stalled-message';
import { createCheckpointStreamInvalidMessage } from './create-checkpoint-stream-invalid-message';
import { createConnectionStatusMessage } from './create-connection-status-message';
import { createOfflineCapStatusMessage } from './create-offline-cap-status-message';
import { createRequestResyncMessage } from './create-request-resync-message';
import { handleClientMessage } from './handle-client-message';
import { handleRequestResyncMessage } from './handle-request-resync-message';
import { reportWorkerFault } from './report-worker-fault';
import { runSimulation } from './run-simulation';
import type { PendingContinuation, WorkerContext } from './types';

export interface WorkerRuntime {
  readonly connections: ReadonlySet<MessagePort>;
  readonly handleConnect: (event: MessageEvent) => void;
  readonly stop: () => void;

  /**
   * Delegates to `stop`, so a test can acquire the runtime with `using` and have teardown run on
   * scope exit. Declared as a readonly function-valued member rather than `extends Disposable`:
   * the built-in interface declares a mutable method, which would make every parameter typed with
   * this interface fail the readonly-parameter lint requirement.
   */
  readonly [Symbol.dispose]: () => void;
}

interface CreateWorkerRuntimeOptions {
  /**
   * Overrides the production same-origin proxy client — a test's only way to route the runtime's
   * calls at a mocked backend, since the real client resolves its URL from `self.location.origin`.
   */
  readonly client?: ActivityServiceClient;

  /**
   * The tick loop's clock, defaulting to `performance.now` — a test injects its own to collapse
   * the loop's real-time pacing instead of waiting out simulated durations in real time.
   */
  readonly now?: () => number;

  readonly timestep?: number;
}

/**
 * Owns one worker process's connections, simulation, and fixed-timestep tick loop. Production
 * wiring (`worker.ts`) constructs exactly one runtime per worker, holding the
 * one-simulation-per-worker invariant.
 */
export function createWorkerRuntime(options: CreateWorkerRuntimeOptions = {}): WorkerRuntime {
  const timestep = options.timestep ?? SIMULATION_TIMESTEP_MS;
  const now = options.now ?? (() => performance.now());

  const connections = new Set<MessagePort>();

  const client = options.client ?? createActivityServiceClient();
  let simulation: null | Simulation = null;
  let activity: ActivityData | null = null;
  let running = false;
  let stopped = false;
  let lastFrameTime = now();
  let accumulator = 0;
  let pendingContinuation: PendingContinuation | null = null;
  let resyncAvatarID: string | null = null;
  let resyncInFlight = false;
  let failureAction: ActivityFailureAction = ActivityFailureAction.Abort;
  let failureActionDirty = false;
  let failureActionPushInFlight = false;

  // Every client message and the self-triggered reconnect resync await this before running, so a
  // relaunch-while-offline never plans against the enum's Abort default while the real cached
  // preference is still in flight. A failed read falls back to that default rather than rejecting
  // forever, which would strand every handler that awaits this.
  const failureActionSeeded = (async () => {
    try {
      const cached = await readFailureActionCache();

      if (cached !== undefined) {
        failureAction = cached.failureAction;
        failureActionDirty = cached.dirty;
      }
    } catch (error) {
      reportWorkerFault('preference-seed', error);
    }
  })();

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
    onFlushStalled: (activityID, reason, traceID) => {
      emitWorkerMessage(createCheckpointFlushStalledMessage(activityID, reason, traceID));
    },
    onInvalid: (activityID, reason, traceID) => {
      emitWorkerMessage(createCheckpointStreamInvalidMessage(activityID, reason, traceID));
    },
  });

  const context: WorkerContext = {
    connections,
    getActivity: () => activity,
    getClient: () => client,
    getFailureAction: () => failureAction,
    getPendingContinuation: () => pendingContinuation,
    getRemainingBudgetMs: () => OFFLINE_PROGRESS_CAP_MS - (Date.now() - lastAckAt),
    getResyncAvatarID: () => resyncAvatarID,
    getRewardSlotLedger: () => ({
      activityID: rewardSlotLedgerActivityID,
      entries: rewardSlotLedger,
    }),
    getSimulation: () => simulation,
    getSubmitter: () => submitter,
    isFailureActionDirty: () => failureActionDirty,
    isFailureActionPushInFlight: () => failureActionPushInFlight,
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
    setFailureAction: (action) => {
      failureAction = action;
    },
    setFailureActionDirty: (dirty) => {
      failureActionDirty = dirty;
    },
    setFailureActionPushInFlight: (inFlight) => {
      failureActionPushInFlight = inFlight;
    },
    setPendingContinuation: (pending) => {
      pendingContinuation = pending;
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

  // cache our listeners so we can message them later
  const handleConnect = (event: MessageEvent) => {
    const [port] = event.ports;

    invariant(port, 'port is required');

    connections.add(port);
    port.start();

    port.addEventListener('message', (messageEvent: MessageEvent<ClientMessage>) => {
      void (async () => {
        try {
          await failureActionSeeded;
          await handleClientMessage(context, port, messageEvent);
        } catch (error) {
          reportWorkerFault('message-routing', error);
        }
      })();
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

      scheduleTick();
    }
  };

  // a fixed timestep keeps updates consistent: the worker isn't tied to UI updates and has no requestAnimationFrame
  const runTickLoop = async () => {
    if (stopped) {
      return;
    }

    const frameNow = now();
    const frameTime = frameNow - lastFrameTime;

    accumulator += frameTime;

    while (accumulator >= timestep) {
      accumulator -= timestep;

      const currentSimulation = context.getSimulation();

      if (currentSimulation) {
        await runSimulation(context, currentSimulation, timestep);
      }
    }

    lastFrameTime = frameNow;

    await wait(1);

    scheduleTick();
  };

  // a crash still stops the loop — the fault is reported, and restarting a simulation that throws
  // deterministically would only flood the error backend with the same crash every tick
  const scheduleTick = () => {
    void (async () => {
      try {
        await runTickLoop();
      } catch (error) {
        reportWorkerFault('tick-loop', error);
      }
    })();
  };

  // The worker's own reconnect recovery: a returning connection resends whatever the submitter
  // held, then — once the held tail is drained, so a resync never reads a stale appended head —
  // self-triggers a resync when nothing is live to catch up an avatar it remembers.
  const handleOnline = () => {
    emitConnectionStatus(true);

    void (async () => {
      try {
        await failureActionSeeded;

        await submitter.flushHeld();

        // the pending continuation is always the fresher signal: it was recorded at the most
        // recent boundary failure, while the remembered resync avatar can predate it
        const avatarID = pendingContinuation?.avatarID ?? resyncAvatarID ?? null;

        if (context.getSimulation() === null && avatarID !== null) {
          await handleRequestResyncMessage(context, createRequestResyncMessage(avatarID));
        }
      } catch (error) {
        reportWorkerFault('reconnect', error);
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

  return { [Symbol.dispose]: stop, connections, handleConnect, stop };
}

function wait(ms: number) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}
