import type { ModelActivity, SettlementModel } from './types';

export function buildModelAfterStart(
  model: Readonly<SettlementModel>,
  activity: Readonly<ModelActivity>,
): SettlementModel {
  const hasChain = model.chains.some((chain) => chain.scopeID === activity.scopeID);

  return {
    ...model,
    activities: [...model.activities, activity],
    chains: hasChain
      ? model.chains
      : [
          ...model.chains,
          { appendedChainIndex: 0, scopeID: activity.scopeID, verifiedChainIndex: 0 },
        ],
  };
}
