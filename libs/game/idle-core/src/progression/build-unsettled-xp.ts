import { parseTerminalCheckpointXP } from './parse-terminal-checkpoint-xp';

interface UnsettledXPInput {
  /**
   * The activity's tail checkpoint payload — its stored `appendedHead` row.
   */
  readonly tailPayload: unknown;

  /**
   * The xp this activity has already contributed to the avatar's settled row.
   */
  readonly settledXP: number;

  /**
   * Summed `rewards.xp` of every checkpoint past the verified cursor. A terminal tail's own total
   * must be excluded from this sum by the caller's query — it is a run total, not a delta. A
   * caller summing in postgres leaves the aggregate at `bigint` — narrowing it to `integer` in SQL
   * overflows once the total passes that ceiling — and converts it to a number here, since the
   * driver hands a bigint over as a string that would concatenate rather than add.
   */
  readonly unverifiedDeltaSum: number;
}

/**
 * The xp an activity has earned but not yet settled — what a display adds on top of the avatar's
 * settled row, and the exact inverse of what verification will pay for the same checkpoints.
 */
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
