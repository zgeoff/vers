import { buildPrefixXP } from './build-prefix-xp';
import type { SettlementModel } from './types';

// a rejected activity counts what the server paid, because a rejection reverses no payout and the
// verifier checks the build against the settled total
export function buildClientBuildXP(model: Readonly<SettlementModel>): number {
  return model.activities.reduce(
    (total, activity) =>
      total +
      (activity.status === 'rejected'
        ? activity.settledXP
        : buildPrefixXP(activity.checkpoints, activity.appendedHead)),
    0,
  );
}
