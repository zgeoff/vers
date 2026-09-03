import type { UndeliveredWork } from '@vers/idle-client';

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
