import type { ActivityData } from '@vers/contract-activity';
import type { ActivityFailureAction, Simulation } from '@vers/idle-core';
import type { CheckpointSubmitter } from '../submission/create-checkpoint-submitter';
import type { ActivityServiceClient } from '../submission/types';
import type {
  ClientMessage,
  RewardSlotLedgerEntry,
  RewardSlotLedgerSnapshot,
  WorkerMessage,
} from '../types';

/**
 * The runtime's structural view of one client connection: a `MessagePort` satisfies it, and so
 * does the broadcast-channel bridge an elected fallback writer serves every tab through. `start`
 * is optional because broadcast channels deliver without an explicit start, and `close` never
 * fires as an event there — the explicit disconnect message stays the reliable teardown path.
 */
export interface WorkerConnection {
  readonly addEventListener: (
    type: 'close' | 'message',
    listener: (event: MessageEvent<ClientMessage>) => void,
  ) => void;
  readonly close: () => void;
  readonly postMessage: (message: WorkerMessage) => void;
  readonly start?: () => void;
}

/**
 * Accessors over the runtime's closure state, threaded to every message and simulation event
 * handler. `connections` is exposed read-only — `removeConnection` is the one mutation a handler
 * needs. `getSubmitter` and `getClient` always return the same instance: both exist for the
 * runtime's whole lifetime, where the simulation is created and later replaced.
 */
export interface WorkerContext {
  /**
   * Marks a player-raised stop: every async flow that installs a simulation or starts a server
   * row captures the epoch at entry and re-checks it after each await, abandoning its install
   * when a stop landed in between — an in-flight resync or continuation must never revive a run
   * the player just ended.
   */
  readonly advanceStopEpoch: () => void;

  readonly connections: ReadonlySet<WorkerConnection>;

  /**
   * The server-authored row the live simulation was last installed from — the scope a terminal
   * checkpoint's continuation starts its next row in, since the engine's own `ActivityInput`
   * carries no scope or avatar id.
   */
  readonly getActivity: () => ActivityData | null;

  readonly getClient: () => ActivityServiceClient;

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
   * The lifecycle mailbox's tail. Starts, resyncs, and continuations queue behind it and run one
   * at a time — interleaved, a stale flow could stop a row a fresher one just attached. Stops
   * stay concurrent; they bump the epoch queued flows re-check.
   */
  readonly getLifecycleTail: () => Readonly<Promise<void>>;

  /**
   * The most recent start request's id. A flow that finds a fresher claim after an await abandons
   * its install, leaving any row it minted for the fresher flow's own recovery.
   */
  readonly getStartRequestID: () => null | string;

  /**
   * The avatar of the claiming resync that arrived while another resync was in flight, held so it
   * runs once the in-flight one settles — dropping it would swallow a deliberate take-over (the
   * player's continue action) behind an automatic resync. `null` when none is held.
   */
  readonly getQueuedClaimResync: () => null | string;

  readonly getStopEpoch: () => number;
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
   * Whether a resync is currently running — the orchestrator's single-flight guard; a request
   * that arrives while one is in flight is dropped rather than queued.
   */
  readonly isResyncInFlight: () => boolean;

  /**
   * Appends one checkpoint's reward-slot count to the retained ledger, resetting it first when the
   * activity differs from the one the retained entries belong to.
   */
  readonly recordRewardSlots: (activityID: string, entry: RewardSlotLedgerEntry) => void;
  readonly removeConnection: (connection: WorkerConnection) => void;
  readonly resetRewardSlotLedger: () => void;
  readonly setActivity: (activity: ActivityData | null) => void;
  readonly setFailureAction: (action: ActivityFailureAction) => void;
  readonly setFailureActionDirty: (dirty: boolean) => void;
  readonly setFailureActionPushInFlight: (inFlight: boolean) => void;
  readonly setQueuedClaimResync: (avatarID: null | string) => void;
  readonly setResyncAvatarID: (avatarID: string) => void;
  readonly setResyncInFlight: (inFlight: boolean) => void;
  readonly setLifecycleTail: (flow: Readonly<Promise<void>>) => void;
  readonly setStartRequestID: (requestID: string) => void;
  readonly setSimulation: (simulation: Simulation) => void;
  readonly setWriterDisplacedActivityID: (activityID: null | string) => void;

  /**
   * Moves the worker's tracked connectivity to the given state, broadcasting the connection
   * status to every tab only on an actual transition — every path that learns the connection's
   * state (native online/offline events, a tab's report, a flush outcome) routes through here, so
   * per-batch outcomes never spam repeat broadcasts.
   */
  readonly updateConnectivity: (online: boolean) => void;
}
