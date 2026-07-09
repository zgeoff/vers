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
 * before one, so a pre-verify tracking call can't purge attempts ahead of the real check. A
 * pending transaction must never be observable sitting at the attempt cap, so this deletes the row
 * directly once it has reached the cap-1 attempt rather than incrementing into the cap and
 * deleting as a separate step. The two conditional statements (delete-at-cap, then
 * increment-below-cap) each re-validate their predicate against the row under its row lock, so
 * concurrent failures on the same transaction serialize instead of racing a read-then-write.
 */
export async function recordFailedAttempt(
  db: Kysely<DB>,
  opts: RecordFailedAttemptOpts,
): Promise<{ attemptsRemaining: number }> {
  const removedAtCap = await removeIfAtCap(db, opts.input.id);

  if (removedAtCap) {
    return { attemptsRemaining: 0 };
  }

  const incremented = await db
    .updateTable('pendingTransactions')
    .set({ attempts: sql`attempts + 1` })
    .where('id', '=', opts.input.id)
    .where('expiresAt', '>', new Date())
    .where('attempts', '<', MAX_TRANSACTION_ATTEMPTS - 1)
    .returning('attempts')
    .executeTakeFirst();

  if (incremented !== undefined) {
    return { attemptsRemaining: MAX_TRANSACTION_ATTEMPTS - incremented.attempts };
  }

  // a concurrent increment may have moved the row to the cap between the delete-at-cap attempt
  // above and this update; retry the delete once before concluding the row is gone or expired
  const removedOnRetry = await removeIfAtCap(db, opts.input.id);

  if (removedOnRetry) {
    return { attemptsRemaining: 0 };
  }

  throw opts.errors.NOT_FOUND({ data: {} });
}

/** Deletes the pending transaction if it has reached the second-to-last allowed attempt. */
async function removeIfAtCap(db: Kysely<DB>, id: string): Promise<boolean> {
  const result = await db
    .deleteFrom('pendingTransactions')
    .where('id', '=', id)
    .where('expiresAt', '>', new Date())
    .where('attempts', '>=', MAX_TRANSACTION_ATTEMPTS - 1)
    .returning('id')
    .executeTakeFirst();

  return result !== undefined;
}
