import type { ActivityData } from '@vers/contract-activity';
import type { OptimisticBuildSource } from '@vers/idle-core';
import { buildLevelFromXP, foldOptimisticBuild } from '@vers/idle-core';
import type { LatestRun, WorkerContext } from './types';

export function buildOptimisticBuildSnapshot(
  context: WorkerContext,
  avatarID: string,
): ActivityData['buildSnapshot'] {
  const latestRun = context.getLatestRun();
  const previousRun = latestRun !== null && latestRun.avatarID === avatarID ? latestRun : null;
  const sources = previousRun === null ? [] : buildPreviousRunSources(previousRun);
  const optimistic = foldOptimisticBuild(previousRun?.baselineXP ?? 0, sources);

  return { level: buildLevelFromXP(optimistic.totalXP), xp: optimistic.totalXP };
}

function buildPreviousRunSources(previousRun: Readonly<LatestRun>): Array<OptimisticBuildSource> {
  if (previousRun.tail === null) {
    return [];
  }

  return [{ settledXP: 0, tailPayload: previousRun.tail, unverifiedDeltaSum: previousRun.deltaXP }];
}
