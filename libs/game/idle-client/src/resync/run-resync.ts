import { isDefinedError, safe } from '@orpc/client';
import type { ActivityData } from '@vers/contract-activity';
import type { ActivityInput, AvatarData } from '@vers/idle-core';
import type { CheckpointSubmitter } from '../submission/create-checkpoint-submitter';
import type { ActivityServiceClient } from '../submission/types';
import { planResync } from './plan-resync';
import { runFastForward } from './run-fast-forward';
import type { FastForwardProgress, ResyncResult } from './types';

interface RunResyncOptions {
  readonly avatarID: string;

  /**
   * Derives the engine's simulation input and avatar from a server-authored activity row, called
   * fresh for every continuation a fast-forward runs through.
   */
  readonly buildSimulationInput: (activity: ActivityData) => {
    activity: ActivityInput;
    avatar: AvatarData;
  };

  readonly capMs?: number;
  readonly client: Pick<ActivityServiceClient, 'getLatestActivityProgress' | 'startActivity'>;
  readonly onProgress?: (progress: FastForwardProgress) => void;
  readonly submitter: CheckpointSubmitter;
}

/**
 * Refetches the avatar's confirmed activity state and dispatches on what it warrants: a
 * fast-forward over the offline gap, a live re-attach, a rebase from a capped stop index, or
 * nothing. The confirmed head and server time are read before any long optimistic re-simulation
 * commits, so a stale local view never produces a large optimistic rollback. An avatar with no
 * activity history resolves to `none`. An `attach-live` plan never registers the submitter itself
 * — under the submitter's single-registration semantics, a premature empty-cursor registration is
 * permanent, so the caller registers only once it has reconstructed the live simulation the cursor
 * belongs to.
 */
export async function runResync(
  // oxlint-disable-next-line typescript/prefer-readonly-parameter-types -- carries a callback-bearing submitter handle and client, neither of which has a readonly form
  options: Readonly<RunResyncOptions>,
): Promise<ResyncResult> {
  const [error, progress] = await safe(
    options.client.getLatestActivityProgress({ avatarID: options.avatarID }),
  );

  if (error !== null) {
    if (isDefinedError(error) && error.code === 'NOT_FOUND') {
      return { plan: { kind: 'none' }, progress: null };
    }

    throw error;
  }

  const plan = planResync({
    progress,
    ...(options.capMs !== undefined && { capMs: options.capMs }),
  });

  if (plan.kind !== 'fast-forward') {
    return { plan, progress };
  }

  const report = await runFastForward({
    budgetMs: plan.budgetMs,
    buildSimulationInput: options.buildSimulationInput,
    client: options.client,
    progress,
    submitter: options.submitter,
    ...(options.onProgress !== undefined && { onProgress: options.onProgress }),
  });

  return { plan, progress, report };
}
