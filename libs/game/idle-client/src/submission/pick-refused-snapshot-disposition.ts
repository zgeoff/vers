import type { LatestActivityProgress } from '../resync/types';

interface PickRefusedSnapshotDispositionInput {
  readonly latest: LatestActivityProgress | null;
  readonly predecessorID: null | string;
}

export type RefusedSnapshotDisposition = 'deferred' | 'rejected';

export function pickRefusedSnapshotDisposition(
  input: Readonly<PickRefusedSnapshotDispositionInput>,
): RefusedSnapshotDisposition {
  if (input.predecessorID === null || input.latest === null) {
    return 'rejected';
  }

  const serverBehind =
    input.latest.activity.id === input.predecessorID && input.latest.activity.status === 'active';

  return serverBehind ? 'deferred' : 'rejected';
}
