import { buildUnsettledXP } from './build-unsettled-xp';

/**
 * One unverified run a fold considers borrowing xp from — its own settled row, the tail payload
 * a fold reads its unsettled total from, and the delta sum of every checkpoint past its verified
 * cursor. A server fold reads these off `activities`/`activityCheckpoints`; a client fold reads
 * them off its own local simulation state for a seed chain the server hasn't seen yet.
 */
export interface OptimisticBuildSource {
  readonly settledXP: number;
  readonly tailPayload: unknown;
  readonly unverifiedDeltaSum: number;
}

export interface OptimisticBuild {
  readonly totalXP: number;
}

/**
 * Folds a settled xp baseline against a set of unverified runs into the optimistic total a new
 * activity's build snapshot stamps. A negative contribution still counts — a death penalty
 * lowered the total, which is a borrow like any other. The server folds a database read of every
 * unverified run into this shape; the client folds its own local simulation state the same way,
 * so a seed chain simulated entirely offline predicts the identical total the server would compute
 * from its own read.
 */
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
