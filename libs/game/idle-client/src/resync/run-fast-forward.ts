import { MAX_CATCH_UP_BATCH_CHECKPOINTS } from '@vers/contract-activity';
import type { ActivityInput, AvatarData, SimulationInputSource } from '@vers/idle-core';
import type { ActivityServiceClient } from '../submission/types';
import { drainOfflineBatches } from './drain-offline-batches';
import { planOfflineContinuations } from './plan-offline-continuations';
import { splitContinuationsIntoBatches } from './split-continuations-into-batches';
import type { FastForwardProgress, FastForwardReport, LatestActivityProgress } from './types';

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
 * Simulates the whole offline gap locally, then ships it as bounded `advanceActivity` batches —
 * the only path that delivers offline continuations, never the per-activity checkpoint submitter.
 * Tallies report optimistically the instant planning completes, before any batch reaches the
 * network; after a rejected batch, the report reconciles down to the confirmed head with zero
 * attempts and level-ups, so the caller's existing `displaced` handling clears the optimistic
 * display exactly as it does after a lost writer race.
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
    options.maxCheckpointsPerBatch ?? MAX_CATCH_UP_BATCH_CHECKPOINTS,
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

  // The delivered plan's final row is always the last continuation's own fresh mint — nothing has
  // been appended onto it yet, so it is live-attachable. A plan that stopped on an aborted failure
  // is the exception: the abort policy's online counterpart never starts a successor, so the
  // caller stops that freshly minted row back durably rather than attaching or resuming it.
  return {
    activity: drained.activity,
    appendedHead: drained.appendedHead,
    attempts,
    finalRowTerminal: plan.reason === 'aborted-on-failure',
    levelUps,
    reason: plan.reason,
  };
}
