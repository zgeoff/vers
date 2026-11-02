import type { InfraOutcome } from './types';

interface InfraOutcomeInput {
  readonly event: string;
  readonly holds: ReadonlyArray<string>;
}

// a person who dispatches the workflow has read the plan that the last run held
export function pickInfraOutcome(input: Readonly<InfraOutcomeInput>): InfraOutcome {
  if (input.holds.length === 0 || input.event === 'workflow_dispatch') {
    return 'apply';
  }

  return 'held';
}
