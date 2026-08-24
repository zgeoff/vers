import type { UndeliveredWork } from '@vers/idle-client';

/**
 * Renders undelivered work for the sign-out warning, e.g. `3 runs, about 12 minutes of play`. A
 * report holding no queued play — a run that started, or one whose checkpoints all reached the
 * server before it ended — names the runs alone, rather than claiming a duration it cannot back.
 * Never called for zero activities; the caller signs out directly instead.
 */
export function formatUndeliveredPlay(work: Readonly<UndeliveredWork>): string {
  const runs = `${work.activityCount} run${work.activityCount === 1 ? '' : 's'}`;

  if (work.playMs === 0) {
    return runs;
  }

  if (work.playMs < 60_000) {
    return `${runs}, under a minute of play`;
  }

  const minutes = Math.round(work.playMs / 60_000);

  return `${runs}, about ${minutes} minute${minutes === 1 ? '' : 's'} of play`;
}
