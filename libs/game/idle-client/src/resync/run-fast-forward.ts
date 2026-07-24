import type { ActivityInput, AvatarData, SimulationInputSource } from '@vers/idle-core';
import type { ActivityServiceClient } from '../submission/types';
import { drainOfflineBatches } from './drain-offline-batches';
import { planOfflineContinuations } from './plan-offline-continuations';
import { splitContinuationsIntoBatches } from './split-continuations-into-batches';
import type { FastForwardProgress, FastForwardReport, LatestActivityProgress } from './types';

/**
 * Bounds a single `advanceActivity` request's total checkpoint count, keeping peak payload size
 * and the server's sync-hash CPU flat regardless of how long the offline gap ran.
 */
const MAX_CHECKPOINTS_PER_BATCH = 500;

interface RunFastForwardOptions {
  readonly budgetMs: number;

  /**
   * Derives the engine's simulation input and avatar from a chain-position source — the
   * verifier derives the same way from the same source, so a stream must never carry one avatar
   * across continuations.
   */
  readonly buildSimulationInput: (source: Readonly<SimulationInputSource>) => {
    activity: ActivityInput;
    avatar: AvatarData;
  };

  readonly client: Pick<ActivityServiceClient, 'advanceActivity'>;

  /**
   * Caps a single bulk request's total checkpoint count — test-only, to drive the chunking
   * boundary without simulating a batch this large.
   */
  readonly maxCheckpointsPerBatch?: number;

  readonly onProgress?: (progress: FastForwardProgress) => void;
  readonly progress: LatestActivityProgress;
}

/**
 * Simulates the whole offline gap locally and instantly through `planOfflineContinuations`, then
 * ships it as bounded `advanceActivity` batches through `drainOfflineBatches` — the only path that
 * delivers offline continuations, never the per-activity `createCheckpointSubmitter`. Tallies
 * report optimistically the instant planning completes, before any batch reaches the network;
 * `drainOfflineBatches` reconciles down to the confirmed head on a rejection, reporting zero
 * attempts and level-ups the same way a lost writer race already does, so the caller's existing
 * `displaced` handling clears the same optimistic display a lost writer race would.
 */
export async function runFastForward(
  options: Readonly<RunFastForwardOptions>,
): Promise<FastForwardReport> {
  const plan = await planOfflineContinuations({
    budgetMs: options.budgetMs,
    buildSimulationInput: options.buildSimulationInput,
    progress: options.progress,
  });

  if (plan.planned.length === 0) {
    return {
      activity: options.progress.activity,
      appendedHead: options.progress.appendedHead,
      attempts: 0,
      finalRowTerminal: false,
      levelUps: 0,
      reason: 'budget-exhausted',
    };
  }

  const attempts = plan.planned.length;
  const levelUps = plan.planned.reduce((sum, continuation) => sum + continuation.levelUps, 0);

  options.onProgress?.({ attempts, levelUps });

  const batches = splitContinuationsIntoBatches(
    plan.planned.map((planned) => planned.continuation),
    options.maxCheckpointsPerBatch ?? MAX_CHECKPOINTS_PER_BATCH,
  );

  const drained = await drainOfflineBatches({
    activity: options.progress.activity,
    appendedHead: options.progress.appendedHead,
    batches,
    client: options.client,
  });

  if (!drained.delivered) {
    return {
      activity: drained.activity,
      appendedHead: drained.appendedHead,
      attempts: 0,
      finalRowTerminal: false,
      levelUps: 0,
      reason: 'displaced',
    };
  }

  // The delivered plan's final row is always the last continuation's own fresh mint — nothing
  // has been appended onto it yet, so it is live-attachable, UNLESS the plan stopped on an
  // aborted failure: the abort policy's online counterpart never starts a successor, so the
  // caller stops this freshly minted row back durably too, rather than attaching or resuming it.
  return {
    activity: drained.activity,
    appendedHead: drained.appendedHead,
    attempts,
    finalRowTerminal: plan.reason === 'aborted-on-failure',
    levelUps,
    reason: plan.reason,
  };
}
