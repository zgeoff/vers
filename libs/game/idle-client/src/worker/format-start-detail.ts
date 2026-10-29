import type { StartStatus } from './worker-contract';

export function formatStartDetail(scopeID: string, status: StartStatus): string {
  if (status.kind !== 'started') {
    return `${scopeID} ${status.kind}`;
  }

  const activity = status.activity;

  return [
    `${scopeID} started ${activity.id}`,
    `index=${activity.startChainIndex}`,
    `xp=${activity.buildSnapshot.xp}`,
    `predecessor=${activity.predecessorActivityID ?? 'none'}`,
  ].join(' ');
}
