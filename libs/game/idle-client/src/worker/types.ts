import type { Simulation } from '@vers/idle-core';
import type { CheckpointSubmitter } from '../submission/create-checkpoint-submitter';
import type { RewardSlotLedgerEntry, RewardSlotLedgerSnapshot } from '../types';

/**
 * Accessors over the runtime's closure state, threaded to every message and simulation event
 * handler. `connections` is exposed read-only — `removeConnection` is the one mutation a handler
 * needs. `getSubmitter` always returns the same instance: the submitter exists for the runtime's
 * whole lifetime, where the simulation is created and later replaced.
 */
export interface WorkerContext {
  readonly connections: ReadonlySet<MessagePort>;

  /**
   * The worker's conservative view of the avatar's offline-progress budget: the cap minus the
   * wall clock elapsed since the last acknowledged submission. It can only under-estimate the
   * server's meter, never over-run it.
   */
  readonly getRemainingBudgetMs: () => number;

  /**
   * The current activity's reward-slot ledger, retained so a tab connecting mid-run receives it in
   * its initial state.
   */
  readonly getRewardSlotLedger: () => RewardSlotLedgerSnapshot;
  readonly getSimulation: () => null | Simulation;
  readonly getSubmitter: () => CheckpointSubmitter;

  /**
   * Appends one checkpoint's reward-slot count to the retained ledger, resetting it first when the
   * activity differs from the one the retained entries belong to.
   */
  readonly recordRewardSlots: (activityID: string, entry: RewardSlotLedgerEntry) => void;
  readonly removeConnection: (port: MessagePort) => void;
  readonly setSimulation: (simulation: null | Simulation) => void;
}
