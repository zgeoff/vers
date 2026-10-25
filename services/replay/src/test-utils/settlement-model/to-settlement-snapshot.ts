import type { SettlementModel, SettlementSnapshot } from './types';

export function toSettlementSnapshot(model: Readonly<SettlementModel>): SettlementSnapshot {
  return {
    activities: model.activities
      .map((activity) => ({
        appendedHead: activity.appendedHead,
        id: activity.id,
        settledXP: activity.settledXP,
        status: activity.status,
        verifiedHead: activity.verifiedHead,
        writer: activity.writer,
      }))
      .toSorted((left, right) => left.id.localeCompare(right.id)),
    avatarXP: model.avatarXP,
    chains: model.chains.toSorted((left, right) => left.scopeID.localeCompare(right.scopeID)),
    grants: model.grants,
    items: model.items,
  };
}
