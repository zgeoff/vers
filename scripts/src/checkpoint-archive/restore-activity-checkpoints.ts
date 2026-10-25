import { buildCheckpointArchiveKey } from './build-checkpoint-archive-key';
import { parseCheckpointArchive } from './parse-checkpoint-archive';
import type { CheckpointArchiveDeps } from './types';

type RestoreOutcome =
  | { readonly key: string; readonly kind: 'missing-archive' }
  | { readonly kind: 'missing-activity' }
  | { readonly kind: 'restored'; readonly restoredRows: number };

export async function restoreActivityCheckpoints(
  deps: CheckpointArchiveDeps,
  activityID: string,
): Promise<RestoreOutcome> {
  const activity = await deps.db
    .selectFrom('activities')
    .select('avatarId')
    .where('id', '=', activityID)
    .executeTakeFirst();

  if (activity === undefined) {
    return { kind: 'missing-activity' };
  }

  const key = buildCheckpointArchiveKey(activity.avatarId, activityID);

  if (!(await deps.bucket.exists(key))) {
    return { key, kind: 'missing-archive' };
  }

  const archive = await deps.bucket.file(key).bytes();

  const rows = parseCheckpointArchive(archive);

  // clearing the stamp returns the activity to the hot tier, so the next sweep archives it again
  const restored = await deps.db
    .with('inserted', (db) =>
      db
        .insertInto('activityCheckpoints')
        .values(rows)
        .onConflict((conflict) => conflict.columns(['activityId', 'version']).doNothing())
        .returning('version'),
    )
    .updateTable('activities')
    .set({ archivedAt: null })
    .where('id', '=', activityID)
    .returning((eb) =>
      eb
        .selectFrom('inserted')
        .select((count) => count.fn.countAll<string>().as('rows'))
        .as('restoredRows'),
    )
    .executeTakeFirstOrThrow();

  return { kind: 'restored', restoredRows: Number(restored.restoredRows) };
}
