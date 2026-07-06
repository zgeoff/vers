import type { DB } from '@vers/db';
import type { Kysely } from 'kysely';

/** oRPC handler opts for the public `stepUp.consumeTransactionToken` procedure. */
interface ConsumeTransactionTokenOpts {
  readonly input: { readonly expiresAt: Date; readonly jti: string };
}

/**
 * Marks a step-up transaction token's jti as used in a durable blocklist (#148): the row's own
 * `expiresAt` — not a TTL cache's lifetime — is what a replay is checked against, so the blocklist
 * outlives any mismatch between the token's validity window and a cache's eviction policy. The
 * insert's `ON CONFLICT DO NOTHING` is the single statement that both claims and detects a replay;
 * a first use inserts and reports `consumed: true`, a replay hits the conflict and inserts nothing.
 */
export async function consumeTransactionToken(
  db: Kysely<DB>,
  opts: ConsumeTransactionTokenOpts,
): Promise<{ consumed: boolean }> {
  await db.deleteFrom('consumedTransactionTokens').where('expiresAt', '<=', new Date()).execute();

  const row = await db
    .insertInto('consumedTransactionTokens')
    .values({ expiresAt: opts.input.expiresAt, jti: opts.input.jti })
    .onConflict((oc) => oc.column('jti').doNothing())
    .returningAll()
    .executeTakeFirst();

  return { consumed: row !== undefined };
}
