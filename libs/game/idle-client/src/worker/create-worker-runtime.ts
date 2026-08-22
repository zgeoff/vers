import type { SupportedMessagePort } from '@orpc/client/message-port';
import { RPCHandler } from '@orpc/server/message-port';
import type { ActivityData } from '@vers/contract-activity';
import { OFFLINE_PROGRESS_CAP_MS } from '@vers/contract-activity';
import type { Simulation } from '@vers/idle-core';
import { ActivityFailureAction, SIMULATION_TIMESTEP_MS, createSimulation } from '@vers/idle-core';
import invariant from 'tiny-invariant';
import type { ActorRefFromLogic } from 'xstate';
import { createActor } from 'xstate';
import { createActivityServiceClient } from '../submission/create-activity-service-client';
import { createCheckpointSubmitter } from '../submission/create-checkpoint-submitter';
import { ingestActivityStart } from '../submission/ingest-activity-start';
import { readFailureActionCache } from '../submission/read-failure-action-cache';
import type { ActivityServiceClient } from '../submission/types';
import { WORKER_TO_CLIENT_CHANNEL } from '../transport/constants';
import { WorkerMessageType } from '../types';
import type { RewardSlotLedgerEntry } from '../types';
import { BUNDLED_ENGINE_HASH } from './bundled-engine-hash';
import { createWorkerRouter } from './create-worker-router';
import { registerSimulationListeners } from './register-simulation-listeners';
import { reportWorkerFault } from './report-worker-fault';
import { runSimulation } from './run-simulation';
import type { WorkerCallContext, WorkerContext } from './types';
import { workerLifecycleMachine } from './worker-lifecycle-machine';
import type { WorkerMessage } from './worker-to-client-message-schema';

export interface WorkerRuntime {
  readonly handleConnect: (event: MessageEvent) => void;
  readonly stop: () => void;

  /**
   * Upgrades an arbitrary structural port onto the runtime's router — the SharedWorker connect
   * path's real port, or a web-locks demux's per-tab virtual one.
   */
  readonly upgrade: (port: SupportedMessagePort, callContext: WorkerCallContext) => void;

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
   * Overrides the build's baked engine hash — a test's only way to pin the hash start calls
   * send, since the production value reads from the bundler's env at module scope.
   */
  readonly bundledEngineHash?: string;

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
 * Owns one worker process's simulation, RPC router, and fixed-timestep tick loop. Production
 * wiring (`worker.ts`, `worker-election.ts`) constructs exactly one runtime per worker, holding
 * the one-simulation-per-worker invariant. The tick loop starts immediately at construction,
 * decoupled from any connection: the elected web-locks writer must tick even before any tab calls
 * in.
 */
export function createWorkerRuntime(options: CreateWorkerRuntimeOptions = {}): WorkerRuntime {
  const timestep = options.timestep ?? SIMULATION_TIMESTEP_MS;
  const now = options.now ?? (() => performance.now());
  const client = options.client ?? createActivityServiceClient();

  const broadcastChannel = new BroadcastChannel(WORKER_TO_CLIENT_CHANNEL);

  // the worker always holds a simulation — "no run" is an empty one; listeners attach right
  // after the context literal below exists
  let simulation: Simulation = createSimulation();
  let activity: ActivityData | null = null;
  let stopped = false;
  let lastFrameTime = now();
  let accumulator = 0;
  let resyncAvatarID: string | null = null;
  let failureAction: ActivityFailureAction = ActivityFailureAction.Abort;
  let failureActionDirty = false;
  let failureActionPushInFlight = false;

  const shutdownController = new AbortController();

  // Online until proven otherwise: a fresh worker's first ack must not read as a reconnect, or
  // every boot would fire a spurious recovery.
  let connectivityOnline = true;

  // Every procedure call and the self-triggered reconnect resync await this before running, so a
  // relaunch-while-offline never plans against the enum's Abort default while the real cached
  // preference is still in flight. A failed read falls back to that default rather than rejecting
  // forever, which would strand every caller awaiting it.
  const failureActionSeeded = (async () => {
    try {
      const cached = await readFailureActionCache();

      if (cached !== undefined) {
        failureAction = cached.failureAction;
        failureActionDirty = cached.dirty;

        // the idle simulation constructed at startup carries its own default until told
        // otherwise — an initialize answering before any run starts must see the seeded value
        // in its snapshot, not the default the simulation booted with
        simulation.setFailureAction(failureAction);
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

  const broadcast = (message: WorkerMessage) => {
    broadcastChannel.postMessage(message);
  };

  const updateConnectivity = (online: boolean) => {
    connectivityOnline = online;
  };

  // `context`'s accessors below close over these before their own `const` declarations run,
  // safe only because nothing calls either accessor until after both are assigned further down
  const getLifecycle = (): ActorRefFromLogic<typeof workerLifecycleMachine> => lifecycleActor;
  const getSubmitter = (): ReturnType<typeof createCheckpointSubmitter> => submitter;

  const context: WorkerContext = {
    advanceStopScope: () => {
      getLifecycle().send({ type: 'ADVANCE_STOP_SCOPE' });
    },
    broadcast,
    getActivity: () => activity,
    getBundledEngineHash: () => options.bundledEngineHash ?? BUNDLED_ENGINE_HASH,
    getCancelSignal: () => getLifecycle().getSnapshot().context.cancelSignal,
    getClient: () => client,
    getConnectivityOnline: () => connectivityOnline,
    getFailureAction: () => failureAction,
    getLifecycle,
    getRemainingBudgetMs: () => OFFLINE_PROGRESS_CAP_MS - (Date.now() - lastAckAt),
    getResyncAvatarID: () => resyncAvatarID,
    getRewardSlotLedger: () => ({
      activityID: rewardSlotLedgerActivityID,
      entries: rewardSlotLedger,
    }),
    getSimulation: () => simulation,
    getStartToken: () => getLifecycle().getSnapshot().context.startToken,
    getStopSignal: () => getLifecycle().getSnapshot().context.stopController.signal,
    getSubmitter,
    getWriterDisplacedActivityID: () =>
      getLifecycle().getSnapshot().context.writerDisplacedActivityID,
    isFailureActionDirty: () => failureActionDirty,
    isFailureActionPushInFlight: () => failureActionPushInFlight,
    recordRewardSlots: (activityID, entry) => {
      if (rewardSlotLedgerActivityID === activityID) {
        rewardSlotLedger = [...rewardSlotLedger, entry];

        return;
      }

      rewardSlotLedgerActivityID = activityID;
      rewardSlotLedger = [entry];
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
    setLastAckAt: (timestamp) => {
      lastAckAt = timestamp;
    },
    setResyncAvatarID: (avatarID) => {
      resyncAvatarID = avatarID;
    },
    setSimulation: (newSimulation) => {
      simulation = newSimulation;
    },
    setStartToken: (token) => {
      getLifecycle().send({ token, type: 'SET_START_TOKEN' });
    },
    setWriterDisplacedActivityID: (activityID) => {
      getLifecycle().send({ activityID, type: 'SET_WRITER_DISPLACED' });
    },
    updateConnectivity,
  };

  const lifecycleActor = createActor(workerLifecycleMachine, {
    input: { failureActionSeeded, runtime: context, shutdownSignal: shutdownController.signal },
  }).start();

  const submitter = createCheckpointSubmitter({
    actor: lifecycleActor.getSnapshot().context.submitterRef,
    client,
    ingestActivityStart: (activityID) => ingestActivityStart(client, activityID),
    onAcked: () => {
      getLifecycle().send({ type: 'SUBMITTER_ACKED' });
    },
    onCapped: () => {
      getLifecycle().send({ type: 'SUBMITTER_CAPPED' });
    },

    // Deferred to a lifecycle turn rather than acted on inline: the callback fires from inside a
    // flush at an arbitrary point, and clearing the simulation mid-install would race the
    // lifecycle flow that owns it.
    onEvicted: (activityID) => {
      getLifecycle().send({ activityID, type: 'SUBMITTER_EVICTED' });
    },
    onHeld: () => {
      getLifecycle().send({ type: 'SUBMITTER_HELD' });
    },

    // The submitter's backoff retries double as a reconnect probe: the first answer after an
    // outage — an ack or a stream-ending rejection, which may be the activity's last traffic —
    // flips the tracked state and recovers without waiting on any tab event.
    onServerContact: () => {
      getLifecycle().send({ type: 'SUBMITTER_SERVER_CONTACT' });
    },
    onFlushStalled: (activityID, reason, traceID) => {
      reportWorkerFault(
        'checkpoint-flush',
        new Error(`checkpoint flush stalled for activity ${activityID}: ${reason}`),
        { traceID },
      );
    },
    onRetryFailed: (activityID, error) => {
      reportWorkerFault(
        'checkpoint-flush',
        new Error(`checkpoint retry loop failed for activity ${activityID}`, { cause: error }),
      );
    },
    onInvalid: (activityID, reason, traceID) => {
      const tags = traceID === undefined ? undefined : { traceID };

      reportWorkerFault(
        'checkpoint-stream',
        new Error(`checkpoint stream rejected for activity ${activityID}: ${reason}`),
        tags,
      );

      broadcast({ activityID, type: WorkerMessageType.CheckpointStreamInvalid });
    },
    signal: shutdownController.signal,
  });

  registerSimulationListeners(context, simulation);

  const router = createWorkerRouter(context, failureActionSeeded);

  const handler = new RPCHandler(router);

  const upgrade = (port: SupportedMessagePort, callContext: WorkerCallContext) => {
    handler.upgrade(port, { context: callContext });
  };

  const handleConnect = (event: MessageEvent) => {
    const [port] = event.ports;

    invariant(port, 'port is required');

    // oRPC's message-port adapters use addEventListener only and never call start() themselves —
    // a MessagePort driven that way stays paused until start() runs, so every call would hang
    port.start();

    upgrade(port, {
      close: () => {
        port.close();
      },
    });
  };

  // a fixed timestep keeps updates consistent: the worker isn't tied to UI updates and has no
  // requestAnimationFrame
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

  // The platform's own reconnect trigger where online events reach workers; Chromium never
  // delivers them here, so tabs relay theirs as messages into the same recovery.
  const handleOnline = () => {
    getLifecycle().send({ type: 'ONLINE' });
  };

  const handleOffline = () => {
    getLifecycle().send({ type: 'OFFLINE' });
  };

  self.addEventListener('online', handleOnline);
  self.addEventListener('offline', handleOffline);

  const stop = () => {
    stopped = true;

    // the lifecycle actor itself keeps running rather than stopping here: a flow already queued
    // behind an in-flight one must still get its turn and answer through its own entry check,
    // which observes the now-permanently-aborted cancel signal and fails cleanly — stopping the
    // actor would instead strand that queued flow's caller awaiting a deferred nothing settles
    shutdownController.abort();
    self.removeEventListener('online', handleOnline);
    self.removeEventListener('offline', handleOffline);
    broadcastChannel.close();
  };

  scheduleTick();

  return { [Symbol.dispose]: stop, handleConnect, stop, upgrade };
}

function wait(ms: number) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}
