import type { IPPostureAction, IPPostureEntry, IPPosturePlan } from './types';

export function planIPPosture(entry: Readonly<IPPostureEntry>): IPPosturePlan {
  if (entry.exposure === 'public') {
    return { actions: [], violations: [] };
  }

  const hasPrivate = entry.ips.some((ip) => ip.type === 'private');

  const actions: ReadonlyArray<IPPostureAction> = hasPrivate
    ? []
    : [{ app: entry.app, kind: 'allocate-flycast-ip' }];

  const violations = [
    ...(hasPrivate ? [] : ['missing its flycast address']),
    ...entry.ips
      .filter((ip) => ip.type === 'public')
      .map((ip) => `public address ${ip.address} on a flycast-only app`),
  ];

  return { actions, violations };
}
