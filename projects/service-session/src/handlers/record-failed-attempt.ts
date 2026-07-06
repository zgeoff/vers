import type { DB } from '@vers/db';
import type { Kysely } from 'kysely';
import { sql } from 'kysely';
import { MAX_TRANSACTION_ATTEMPTS } from '../consts';
import type { EmptyErrorPayload } from '../types';

/** oRPC handler opts for the public `stepUp.recordFailedAttempt` procedure. */
interface RecordFailedAttemptOpts {
  readonly errors: {
    readonly NOT_FOUND: (payload: EmptyErrorPayload) => Error;
  };
  readonly input: { readonly id: string };
}

/**
 * Records a failed step-up verification attempt — called only after a failed verification, never
 * before one, so a pre-verify tracking call can't purge attempts ahead of the real check. The
 * increment is one conditional UPDATE with `RETURNING`, so concurrent failures on the same
 * transaction serialize on the row instead of racing a read-then-write. A transaction that hits
 * the attempt cap is abandoned immediately rather than left consumable at zero attempts remaining.
 */
export async function recordFailedAttempt(
  db: Kysely<DB>,
  opts: RecordFailedAttemptOpts,
): Promise<{ attemptsRemaining: number }> {
  const row = await db
    .updateTable('pendingTransactions')
    .set({ attempts: sql`attempts + 1` })
    .where('id', '=', opts.input.id)
    .where('expiresAt', '>', new Date())
    .returning('attempts')
    .executeTakeFirst();

  if (row === undefined) {
    throw opts.errors.NOT_FOUND({ data: {} });
  }

  if (row.attempts >= MAX_TRANSACTION_ATTEMPTS) {
    await db.deleteFrom('pendingTransactions').where('id', '=', opts.input.id).execute();

    return { attemptsRemaining: 0 };
  }

  return { attemptsRemaining: MAX_TRANSACTION_ATTEMPTS - row.attempts };
}
