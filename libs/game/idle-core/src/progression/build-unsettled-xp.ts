import { parseTerminalCheckpointXP } from './parse-terminal-checkpoint-xp';

interface UnsettledXPInput {
  readonly tailPayload: unknown;

  readonly settledXP: number;

  readonly unverifiedDeltaSum: number;
}

export function buildUnsettledXP(input: Readonly<UnsettledXPInput>): number {
  const terminalTotal = parseTerminalCheckpointXP(input.tailPayload);

  if (terminalTotal === undefined) {
    // Every non-terminal tail carries per-checkpoint deltas, so what remains is their sum past
    // the verified cursor.
    return input.unverifiedDeltaSum;
  }

  // A terminal tail carries the run's final total, so what remains is that total less whatever
  // earlier segments already settled.
  return terminalTotal - input.settledXP;
}
