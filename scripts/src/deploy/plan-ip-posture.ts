import type { IPPostureAction, IPPostureEntry, IPPosturePlan } from './types';

/**
 * Decides what a manifest entry's IP allocation still needs: a `flycast` entry with no private
 * address gets an allocation action plus a violation naming the gap, and any public address it
 * holds is a violation — reported, never auto-released, since releasing a live address risks
 * cutting inbound traffic mid-flight for whatever still targets it. Violations are the complete
 * verify-facing findings list; callers report them verbatim rather than deriving their own. A
 * `public` entry needs neither; its addresses are provisioned by hand.
 */
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
