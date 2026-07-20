import type { ActivityData } from '@vers/contract-activity';
import { OFFLINE_PROGRESS_CAP_MS } from '@vers/contract-activity';
import type { Simulation } from '@vers/idle-core';
import { ActivityFailureAction, SIMULATION_TIMESTEP_MS, createSimulation } from '@vers/idle-core';
import invariant from 'tiny-invariant';
import { createActivityServiceClient } from '../submission/create-activity-service-client';
import { createCheckpointSubmitter } from '../submission/create-checkpoint-submitter';
import { readFailureActionCache } from '../submission/read-failure-action-cache';
import { readPendingStartIntent } from '../submission/read-pending-start-intent';
import type { ActivityServiceClient } from '../submission/types';
import type {
  ClientMessage,
  RequestResyncMessage,
  RewardSlotLedgerEntry,
  WorkerMessage,
} from '../types';
import { createCheckpointFlushStalledMessage } from './create-checkpoint-flush-stalled-message';
import { createCheckpointStreamInvalidMessage } from './create-checkpoint-stream-invalid-message';
import { createConnectionStatusMessage } from './create-connection-status-message';
import { createOfflineCapStatusMessage } from './create-offline-cap-status-message';
import { createRequestResyncMessage } from './create-request-resync-message';
import { flushPendingStop } from './flush-pending-stop';
import { handleClientMessage } from './handle-client-message';
import { handleRequestResyncMessage } from './handle-request-resync-message';
import { registerSimulationListeners } from './register-simulation-listeners';
import { reportWorkerFault } from './report-worker-fault';
import { resetSimulation } from './reset-simulation';
import { runSimulation } from './run-simulation';
import type { WorkerContext } from './types';
import { updateWriterDisplacedStatus } from './update-writer-displaced-status';
import { withLifecycleTurn } from './with-lifecycle-turn';

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

  // the worker always holds a simulation — "no run" is an empty one; listeners attach right
  // after the context literal below exists
  let simulation: Simulation = createSimulation();
  let activity: ActivityData | null = null;
  let running = false;
  let stopped = false;
  let lastFrameTime = now();
  let accumulator = 0;
  let resyncAvatarID: string | null = null;
  let resyncInFlight = false;
  let failureAction: ActivityFailureAction = ActivityFailureAction.Abort;
  let failureActionDirty = false;
  let failureActionPushInFlight = false;
  let stopEpoch = 0;
  let startRequestID: null | string = null;
  let lifecycleTail: Readonly<Promise<void>> = Promise.resolve();
  let queuedClaimResync: RequestResyncMessage | null = null;
  let writerDisplacedActivityID: null | string = null;

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

    // Deferred to a lifecycle turn rather than acted on inline: the callback fires from inside a
    // flush at an arbitrary point, and clearing the simulation mid-install would race the
    // lifecycle flow that owns it. The turn re-checks the eviction marker — a claiming resync
    // that re-attached the stream in the meantime has superseded it, and clearing then would
    // tear down the healthy run it just installed.
    onEvicted: (activityID) => {
      void withLifecycleTurn(context, 'eviction', () => {
        if (!submitter.isEvicted(activityID)) {
          return Promise.resolve();
        }

        if (context.getActivity()?.id === activityID) {
          resetSimulation(context);
        }

        updateWriterDisplacedStatus(context, activityID);

        return Promise.resolve();
      });
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
    advanceStopEpoch: () => {
      stopEpoch += 1;
    },
    connections,
    getActivity: () => activity,
    getClient: () => client,
    getFailureAction: () => failureAction,
    getRemainingBudgetMs: () => OFFLINE_PROGRESS_CAP_MS - (Date.now() - lastAckAt),
    getResyncAvatarID: () => resyncAvatarID,
    getRewardSlotLedger: () => ({
      activityID: rewardSlotLedgerActivityID,
      entries: rewardSlotLedger,
    }),
    getSimulation: () => simulation,
    getLifecycleTail: () => lifecycleTail,
    getQueuedClaimResync: () => queuedClaimResync,
    getStartRequestID: () => startRequestID,
    getStopEpoch: () => stopEpoch,
    getSubmitter: () => submitter,
    getWriterDisplacedActivityID: () => writerDisplacedActivityID,
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
    resetRewardSlotLedger: () => {
      rewardSlotLedgerActivityID = null;
      rewardSlotLedger = [];
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
    setQueuedClaimResync: (message) => {
      queuedClaimResync = message;
    },
    setResyncAvatarID: (avatarID) => {
      resyncAvatarID = avatarID;
    },
    setResyncInFlight: (inFlight) => {
      resyncInFlight = inFlight;
    },
    setLifecycleTail: (flow) => {
      lifecycleTail = flow;
    },
    setStartRequestID: (requestID) => {
      startRequestID = requestID;
    },
    setSimulation: (newSimulation) => {
      simulation = newSimulation;
    },
    setWriterDisplacedActivityID: (activityID) => {
      writerDisplacedActivityID = activityID;
    },
  };

  registerSimulationListeners(context, simulation);

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

      await runSimulation(context, context.getSimulation(), timestep);
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
  // self-triggers a resync when no run is live to catch up an avatar it remembers.
  const handleOnline = () => {
    emitConnectionStatus(true);

    void (async () => {
      try {
        await failureActionSeeded;

        await submitter.flushHeld();

        // A stop raised offline delivers here even when no resync will follow — the self-resync
        // below runs only while no run is live.
        await flushPendingStop(context);

        // the durable start intent is always the fresher signal: it was recorded at the most
        // recent boundary failure, while the remembered resync avatar can predate it
        const heldIntent = await readPendingStartIntent();

        const avatarID = heldIntent?.avatarID ?? resyncAvatarID ?? null;

        // a reconnect is an automatic trigger, never a deliberate attach — it must not take the
        // writer from a device the player is actively driving
        if (context.getActivity() === null && avatarID !== null) {
          await handleRequestResyncMessage(context, createRequestResyncMessage(avatarID, false));
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
