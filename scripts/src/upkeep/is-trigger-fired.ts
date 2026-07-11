import type { Trigger } from './types';

interface TriggerFacts {
  readonly latestVersion?: string | undefined;
  readonly today: string;
}

/**
 * Decides whether a trigger's condition holds given already-fetched facts:
 * a release trigger fires when the registry's latest version exceeds the
 * recorded bound, a date trigger when today reaches the recorded date.
 */
export function isTriggerFired(trigger: Trigger, facts: TriggerFacts): boolean {
  if (trigger.kind === 'date') {
    return facts.today >= trigger.date;
  }

  if (facts.latestVersion === undefined || facts.latestVersion === '') {
    return false;
  }

  return Bun.semver.order(facts.latestVersion, trigger.version) > 0;
}
