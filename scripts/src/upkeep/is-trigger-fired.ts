import type { Trigger } from './types';

interface TriggerFacts {
  readonly latestVersion?: string | undefined;
  readonly today: string;
}

export function isTriggerFired(trigger: Trigger, facts: TriggerFacts): boolean {
  if (trigger.kind === 'date') {
    return facts.today >= trigger.date;
  }

  if (facts.latestVersion === undefined || facts.latestVersion === '') {
    return false;
  }

  return Bun.semver.order(facts.latestVersion, trigger.version) > 0;
}
