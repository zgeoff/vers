import type { DB } from '@vers/db';
import type { Kysely } from 'kysely';
import type { RecordReleaseInput, ReleaseRow } from './types';

/**
 * Appends a `releases` row for a rollout that passed its post-deploy probes. Rows are only ever
 * appended — the newest row per app is that app's rollback target, so a failed rollout must never
 * be recorded.
 */
export function recordRelease(
  db: Kysely<DB>,
  input: Readonly<RecordReleaseInput>,
): Promise<ReleaseRow> {
  return db
    .insertInto('releases')
    .values({
      app: input.app,
      gitSha: input.gitSHA,
      image: input.image,
      imageDigest: input.imageDigest,
    })
    .returningAll()
    .executeTakeFirstOrThrow();
}
