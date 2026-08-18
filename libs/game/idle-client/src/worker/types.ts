import type { ActivityData } from '@vers/contract-activity';
import type { ActivityFailureAction, Simulation } from '@vers/idle-core';
import type { ActorRefFromLogic } from 'xstate';
import type { CheckpointSubmitter } from '../submission/create-checkpoint-submitter';
import type { ActivityServiceClient } from '../submission/types';
import type { RewardSlotLedgerEntry, RewardSlotLedgerSnapshot } from '../types';
import type { workerLifecycleMachine } from './worker-lifecycle-machine';
import type { WorkerMessage } from './worker-to-client-message-schema';

/**
 * Per-connection state an upgraded `MessagePort` carries into every procedure call: `close`
 * releases whatever the transport holds for that connection — the real port on the `SharedWorker`
 * path, this tab's entry in the web-locks demux's registry on the other.
 */
export interface WorkerCallContext {
  readonly close: () => void;
}

/**
 * The cancellation signals a lifecycle flow captures once at entry: `stop` carries the player-stop
 * cause alone and is what compensation branches test — a run must survive a worker reload, so
 * shutdown never triggers a stop-back. `cancel` folds in worker shutdown and cancels in-flight
 * reads.
 */
export interface FlowSignals {
  readonly cancel: AbortSignal;
  readonly stop: AbortSignal;
}

export interface StartActivityInput {
  readonly avatarID: string;
  readonly scopeID: string;
  readonly scopeType: string;
}

export interface StopActivityInput {
  readonly activityID: string;
  readonly avatarID: string;
}

/**
 * Accessors over the runtime's closure state, threaded to every procedure and simulation event
 * handler. `broadcast` is the worker's one fan-out path — every connected tab, on either transport,
 * receives it. `getSubmitter` and `getClient` always return the same instance: both exist for the
 * runtime's whole lifetime, where the simulation is created and later replaced.
 */
export interface WorkerContext {
  /**
   * Marks a player-raised stop: aborts the current stop scope's signal and installs a fresh one.
   * Every async flow that installs a simulation or starts a server row captures the stop signal at
   * entry and re-checks it after each await, abandoning its install when a stop landed in between —
   * an in-flight resync or continuation must never revive a run the player just ended.
   */
  readonly advanceStopScope: () => void;

  /**
   * Posts one message to every connected tab, on whichever transport carries it — a real
   * `SharedWorker` connection or the elected web-locks writer's broadcast channel.
   */
  readonly broadcast: (message: WorkerMessage) => void;

  /**
   * The server-authored row the live simulation was last installed from — the scope a terminal
   * checkpoint's continuation starts its next row in, since the engine's own `ActivityInput`
   * carries no scope or avatar id.
   */
  readonly getActivity: () => ActivityData | null;

  /**
   * The sim engine hash baked into this build, sent as the pinned `simVersion` on every start
   * call. Undefined in dev builds, which start against the registry's current stamp instead.
   */
  readonly getBundledEngineHash: () => string | undefined;

  readonly getClient: () => ActivityServiceClient;

  /**
   * The worker's tracked connectivity, driving the reconnect-recovery decision alone — nothing is
   * broadcast to tabs from a read of it. `true` until a flush or a native offline event proves
   * otherwise, so a fresh worker's first ack never reads as a reconnect.
   */
  readonly getConnectivityOnline: () => boolean;

  /**
   * The avatar's failure-action preference: the in-session source of truth every simulation input
   * derivation reads from. Seeded from the device-local cache at worker boot, then held here for
   * the worker's lifetime — a live simulation mirrors it, it never reads back from one.
   */
  readonly getFailureAction: () => ActivityFailureAction;

  /**
   * The worker's conservative view of the avatar's offline-progress budget: the cap minus the
   * wall clock elapsed since the last acknowledged submission. It can only under-estimate the
   * server's meter, never over-run it.
   */
  readonly getRemainingBudgetMs: () => number;

  /**
   * The avatar the last resync ran for — remembered so a reconnect can self-trigger a resync
   * without a tab having to re-report. `null` until the first resync of the worker's lifetime.
   */
  readonly getResyncAvatarID: () => string | null;

  /**
   * The current activity's reward-slot ledger, retained so a tab connecting mid-run receives it in
   * its initial state.
   */
  readonly getRewardSlotLedger: () => RewardSlotLedgerSnapshot;
  readonly getSimulation: () => Simulation;

  /**
   * The running lifecycle actor: the single owner of flow serialization. Starts, resyncs,
   * continuations, and evictions run strictly one at a time through its queue — interleaved, a
   * stale flow could stop a row a fresher one just attached. It also coalesces resyncs, dropping a
   * non-claiming call while one is queued or running and holding at most one claiming call, latest
   * wins. A stop is handled in every declared state and never waits behind the queue. An entry
   * point sends it an event; a test reads its declared state directly off the snapshot.
   */
  readonly getLifecycle: () => ActorRefFromLogic<typeof workerLifecycleMachine>;

  /**
   * The most recent start call's token, minted fresh by the worker on every `startActivity` call —
   * never carried over the wire. A flow that finds a fresher token after an await abandons its
   * install, leaving any row it minted for the fresher flow's own recovery.
   */
  readonly getStartToken: () => null | string;

  /**
   * The composite of the current stop scope's signal and the runtime-lifetime shutdown signal,
   * stable within a stop scope. Threaded into cancellation-safe request options; a pure unwind
   * with nothing to compensate may `throwIfAborted()` on it directly.
   */
  readonly getCancelSignal: () => AbortSignal;

  /**
   * The current stop scope's signal alone — the one every compensation branch tests, since only a
   * player stop, never a worker shutdown, may stop a minted row back durably.
   */
  readonly getStopSignal: () => AbortSignal;

  readonly getSubmitter: () => CheckpointSubmitter;

  /**
   * The activity another session displaced this device from, `null` when none. Held so the
   * displacement broadcast fires only on transition and a connecting tab's initial state carries
   * it.
   */
  readonly getWriterDisplacedActivityID: () => null | string;

  /**
   * Whether the held failure action is a local value the server hasn't acknowledged yet — set the
   * instant a tab changes it, cleared once the push to the server succeeds. A resync consults this
   * to decide whether to push the local value or adopt the server's.
   */
  readonly isFailureActionDirty: () => boolean;

  /**
   * Whether a push of the failure action to the server is running. Overlapping tab changes coalesce
   * onto the running push rather than racing their own — a later change is picked up by the running
   * loop, so a stale acknowledgement never clears the dirty flag for a value already superseded.
   */
  readonly isFailureActionPushInFlight: () => boolean;

  /**
   * Appends one checkpoint's reward-slot count to the retained ledger, resetting it first when the
   * activity differs from the one the retained entries belong to.
   */
  readonly recordRewardSlots: (activityID: string, entry: RewardSlotLedgerEntry) => void;
  readonly resetRewardSlotLedger: () => void;
  readonly setActivity: (activity: ActivityData | null) => void;
  readonly setFailureAction: (action: ActivityFailureAction) => void;
  readonly setFailureActionDirty: (dirty: boolean) => void;
  readonly setFailureActionPushInFlight: (inFlight: boolean) => void;

  /**
   * Re-anchors the offline-progress budget to the given instant — called once per acknowledged
   * submission, so `getRemainingBudgetMs` measures forward from the worker's last confirmed
   * contact rather than draining across a session that never lost connectivity.
   */
  readonly setLastAckAt: (timestamp: number) => void;

  readonly setResyncAvatarID: (avatarID: null | string) => void;
  readonly setStartToken: (token: string) => void;
  readonly setSimulation: (simulation: Simulation) => void;
  readonly setWriterDisplacedActivityID: (activityID: null | string) => void;

  /**
   * Moves the worker's tracked connectivity to the given state — worker-internal, driving only
   * the reconnect-recovery decision; nothing is broadcast to tabs. Every path that learns the
   * connection's state (native online/offline events, a tab's report, a flush outcome) routes
   * through here.
   */
  readonly updateConnectivity: (online: boolean) => void;
}
