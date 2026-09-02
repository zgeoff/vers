import type { DB } from '@vers/db';
import type { Kysely } from 'kysely';
import { sql } from 'kysely';
import type { SimVersionRow } from './types';

export function updateExpiredSimVersions(db: Kysely<DB>): Promise<Array<SimVersionRow>> {
  return (
    db
      .updateTable('simVersions')

      // Flipping status to pruned rather than deleting the row lets dispatch tell a
      // retained-but-expired version (a pruned row: force a resync) apart from an unregistered one
      // (no row: park the activity).
      .set({ status: 'pruned' })
      .where('status', '=', 'active')
      .where('retainedUntil', '<', sql<Date>`now()`)

      // Excludes the current version (the newest active row by deployedAt) regardless of its own
      // retainedUntil, so a lone active row is always protected. The active guard on both sides also
      // keeps a repeat run from re-returning rows a prior sweep already pruned.
      .where('engineHash', 'is distinct from', (eb) =>
        eb
          .selectFrom('simVersions')
          .select('engineHash')
          .where('status', '=', 'active')
          .orderBy('deployedAt', 'desc')
          .limit(1),
      )
      .returningAll()
      .execute()
  );
}
