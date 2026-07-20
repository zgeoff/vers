import type { ActivityData } from '@vers/contract-activity';
import type { ActivityFailureAction, Simulation } from '@vers/idle-core';
import type { CheckpointSubmitter } from '../submission/create-checkpoint-submitter';
import type { ActivityServiceClient } from '../submission/types';
import type { RewardSlotLedgerEntry, RewardSlotLedgerSnapshot } from '../types';

/**
 * A continuation the worker wanted to start but couldn't complete — a same-row `CONFLICT`
 * (the terminal append that closes the row is still unacknowledged) or a transport failure on its
 * own start-activity call. `activityID` names the row the pending intent was raised against, so a
 * resync plans `continue` only once that exact row reads closed, never a different one. The row
 * it eventually starts takes the worker's current failure action, not a snapshot from raise time,
 * so a preference changed while the intent waited still applies.
 */
export interface PendingContinuation {
  readonly activityID: string;
  readonly avatarID: string;
  readonly scopeID: string;
  readonly scopeType: string;
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

  readonly connections: ReadonlySet<MessagePort>;

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
   * The continuation intent a resync should honor once its target row reads closed — `null` when
   * no continuation is outstanding.
   */
  readonly getPendingContinuation: () => PendingContinuation | null;

  /**
   * The worker's conservative view of the avatar's offline-progress budget: the cap minus the
   * wall clock elapsed since the last acknowledged submission. It can only under-estimate the
   * server's meter, never over-run it.
   */
  readonly getRemainingBudgetMs: () => number;

  /**
   * The avatar a resync was last requested for — remembered so a reconnect can self-trigger a
   * resync without a tab having to resend it. `null` until the tab's first request.
   */
  readonly getResyncAvatarID: () => string | null;

  /**
   * The current activity's reward-slot ledger, retained so a tab connecting mid-run receives it in
   * its initial state.
   */
  readonly getRewardSlotLedger: () => RewardSlotLedgerSnapshot;
  readonly getSimulation: () => null | Simulation;

  /**
   * The most recent start request's id — every start flow re-checks it after each await and
   * abandons its install when a fresher request has claimed the runtime, leaving any row it
   * already minted for that fresher flow's own conflict recovery.
   */
  readonly getStartRequestID: () => null | string;

  readonly getStopEpoch: () => number;
  readonly getSubmitter: () => CheckpointSubmitter;

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
  readonly removeConnection: (port: MessagePort) => void;
  readonly resetRewardSlotLedger: () => void;
  readonly setActivity: (activity: ActivityData | null) => void;
  readonly setFailureAction: (action: ActivityFailureAction) => void;
  readonly setFailureActionDirty: (dirty: boolean) => void;
  readonly setFailureActionPushInFlight: (inFlight: boolean) => void;
  readonly setPendingContinuation: (pending: PendingContinuation | null) => void;
  readonly setResyncAvatarID: (avatarID: string) => void;
  readonly setResyncInFlight: (inFlight: boolean) => void;
  readonly setStartRequestID: (requestID: string) => void;
  readonly setSimulation: (simulation: null | Simulation) => void;
}
