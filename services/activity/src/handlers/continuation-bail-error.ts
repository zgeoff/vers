import type { BailOutcome } from './types';

// a throw is the only way to roll a continuation back: Kysely's transaction().execute() commits on
// any normal return, whatever the value
export class ContinuationBailError extends Error {
  readonly outcome: BailOutcome;

  constructor(outcome: Readonly<BailOutcome>) {
    super(`advanceActivity continuation bailed: ${outcome.kind}`);

    this.name = 'ContinuationBailError';
    this.outcome = outcome;
  }
}
