import type { DB } from '@vers/db';
import type { Kysely } from 'kysely';
import type { RecordReleaseInput, ReleaseRow } from './types';

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
