import type { DB } from '@vers/db';
import type { Kysely } from 'kysely';
import { sql } from 'kysely';
import { z } from 'zod';

type ArchiveLockOutcome<T> =
  | { readonly kind: 'busy' }
  | { readonly kind: 'locked'; readonly result: T };

const ARCHIVE_LOCK_KEY = 'vers.checkpoint-archive';
const LockRowSchema = z.object({ acquired: z.boolean() });

export function withArchiveLock<T>(
  db: Kysely<DB>,
  work: (connection: Kysely<DB>) => Promise<T>,
): Promise<ArchiveLockOutcome<T>> {
  // a session lock lives on one connection, so the work runs on the connection that holds it
  return db.connection().execute(async (connection) => {
    const locked =
      await sql`select pg_try_advisory_lock(hashtext(${ARCHIVE_LOCK_KEY})) as acquired`.execute(
        connection,
      );

    const [row] = z.array(LockRowSchema).parse(locked.rows);

    if (row?.acquired !== true) {
      return { kind: 'busy' } as const;
    }

    try {
      const result = await work(connection);

      return { kind: 'locked', result } as const;
    } finally {
      await sql`select pg_advisory_unlock(hashtext(${ARCHIVE_LOCK_KEY}))`.execute(connection);
    }
  });
}
