import { buildUnsettledXP } from './build-unsettled-xp';

export interface OptimisticBuildSource {
  readonly settledXP: number;
  readonly tailPayload: unknown;
  readonly unverifiedDeltaSum: number;
}

export interface OptimisticBuild {
  readonly totalXP: number;
}

export function foldOptimisticBuild(
  settledXP: number,
  sources: ReadonlyArray<Readonly<OptimisticBuildSource>>,
): OptimisticBuild {
  let totalXP = settledXP;

  for (const source of sources) {
    totalXP += buildUnsettledXP({
      settledXP: source.settledXP,
      tailPayload: source.tailPayload,
      unverifiedDeltaSum: source.unverifiedDeltaSum,
    });
  }

  return { totalXP };
}
