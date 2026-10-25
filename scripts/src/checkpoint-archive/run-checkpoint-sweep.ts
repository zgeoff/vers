import { archiveActivityCheckpoints } from './archive-activity-checkpoints';
import { CHECKPOINT_RETENTION } from './checkpoint-retention';
import { readArchiveCandidates } from './read-archive-candidates';
import { readExpiredArchives } from './read-expired-archives';
import { removeExpiredArchives } from './remove-expired-archives';
import type { CheckpointArchiveDeps } from './types';

interface RunCheckpointSweepInput {
  readonly apply: boolean;
  readonly limit: number;
  readonly now: Date;
}

interface CheckpointSweepSummary {
  readonly archived: number;
  readonly candidates: number;
  readonly changed: number;
  readonly deletedRows: number;
  readonly expiredArchives: number;
  readonly purged: number;
}

export async function runCheckpointSweep(
  deps: CheckpointArchiveDeps,
  input: Readonly<RunCheckpointSweepInput>,
): Promise<CheckpointSweepSummary> {
  const candidates = await readArchiveCandidates(deps.db, {
    limit: input.limit,
    verifiedBefore: new Date(input.now.getTime() - CHECKPOINT_RETENTION.hotWindowMs),
  });

  const writtenBefore = new Date(input.now.getTime() - CHECKPOINT_RETENTION.archiveRetentionMs);

  const expired = await readExpiredArchives(deps, writtenBefore);

  if (!input.apply) {
    return {
      archived: 0,
      candidates: candidates.length,
      changed: 0,
      deletedRows: 0,
      expiredArchives: expired.length,
      purged: 0,
    };
  }

  const outcomes = [];

  for (const candidate of candidates) {
    const outcome = await archiveActivityCheckpoints(deps, candidate, input.now);

    outcomes.push(outcome);
  }

  const purged = await removeExpiredArchives(deps, expired, writtenBefore);

  const archived = outcomes.filter((outcome) => outcome.kind === 'archived');

  return {
    archived: archived.length,
    candidates: candidates.length,
    changed: outcomes.length - archived.length,
    deletedRows: archived.reduce((total, outcome) => total + outcome.deletedRows, 0),
    expiredArchives: expired.length,
    purged,
  };
}
