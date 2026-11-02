import type { InfraOutcome } from './types';

interface InfraOutcomeInput {
  readonly event: string;
  readonly holds: ReadonlyArray<string>;
  readonly isMainTip: boolean;
}

// a person who dispatches the workflow has read the plan that the last run held, but a rerun of an
// old dispatch keeps its old commit, whose plan would revert every change applied since
export function pickInfraOutcome(input: Readonly<InfraOutcomeInput>): InfraOutcome {
  if (input.holds.length === 0) {
    return 'apply';
  }

  if (input.event === 'workflow_dispatch' && input.isMainTip) {
    return 'apply';
  }

  return 'held';
}
