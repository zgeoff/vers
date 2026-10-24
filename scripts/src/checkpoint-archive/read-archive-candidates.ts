import type { DB } from '@vers/db';
import type { Kysely } from 'kysely';
import type { ArchiveCandidate } from './types';

interface ReadArchiveCandidatesInput {
  readonly limit: number;
  readonly verifiedBefore: Date;
}

export async function readArchiveCandidates(
  db: Kysely<DB>,
  input: Readonly<ReadArchiveCandidatesInput>,
): Promise<Array<ArchiveCandidate>> {
  const rows = await db
    .selectFrom('activities')
    .select(['id', 'avatarId', 'appendedHead'])
    .where('archivedAt', 'is', null)
    .where('status', 'in', ['stopped', 'capped'])
    .where((eb) => eb('verifiedHead', '=', eb.ref('appendedHead')))
    .where('appendedHead', '>', 0)
    .where('verifiedAt', '<', input.verifiedBefore)
    .orderBy('verifiedAt')
    .orderBy('id')
    .limit(input.limit)
    .execute();

  return rows.map((row) => ({
    activityID: row.id,
    appendedHead: row.appendedHead,
    avatarID: row.avatarId,
  }));
}
