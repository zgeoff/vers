import type { CatchUpContinuation } from '@vers/contract-activity';

interface PlannedReturnStart {
  readonly activityID: string;
  readonly xp: number;
}

// a continuation carries the checkpoints of the activity before it and the build its own activity
// starts from, so each activity earns the gap between its start build's XP and the next one's;
// the last continuation's activity is still open and has earned nothing
export function buildPlannedReturnXP(
  start: Readonly<PlannedReturnStart>,
  continuations: ReadonlyArray<Pick<CatchUpContinuation, 'buildSnapshot' | 'id'>>,
): Map<string, number> {
  const earned = new Map<string, number>();

  let previous = start;

  for (const continuation of continuations) {
    earned.set(previous.activityID, continuation.buildSnapshot.xp - previous.xp);

    previous = { activityID: continuation.id, xp: continuation.buildSnapshot.xp };
  }

  earned.set(previous.activityID, 0);

  return earned;
}
