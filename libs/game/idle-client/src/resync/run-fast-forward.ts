import { MAX_CATCH_UP_BATCH_CHECKPOINTS } from '@vers/contract-activity';
import type { ActivityInput, AvatarData, SimulationInputSource } from '@vers/idle-core';
import type { ActivityServiceClient } from '../submission/types';
import { drainOfflineBatches } from './drain-offline-batches';
import { planOfflineContinuations } from './plan-offline-continuations';
import { splitContinuationsIntoBatches } from './split-continuations-into-batches';
import type { FastForwardProgress, FastForwardReport, LatestActivityProgress } from './types';

interface RunFastForwardOptions {
  readonly budgetMs: number;

  readonly buildSimulationInput: (
    source: Readonly<SimulationInputSource>,
  ) => Promise<{ activity: ActivityInput; avatar: AvatarData }>;

  readonly client: Pick<ActivityServiceClient, 'advanceActivity'>;

  readonly maxCheckpointsPerBatch?: number;

  readonly onProgress?: (progress: FastForwardProgress) => void;
  readonly progress: LatestActivityProgress;
}

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

  // the final row is the last continuation's fresh mint with nothing appended, so it is
  // live-attachable; after an aborted failure the caller stops it back durably instead, as the
  // abort policy never starts a successor online either
  return {
    activity: drained.activity,
    appendedHead: drained.appendedHead,
    attempts,
    finalRowTerminal: plan.reason === 'aborted-on-failure',
    levelUps,
    reason: plan.reason,
  };
}
