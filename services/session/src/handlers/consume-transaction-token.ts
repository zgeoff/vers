import type { DB } from '@vers/db';
import type { Kysely } from 'kysely';

interface ConsumeTransactionTokenOpts {
  readonly input: { readonly expiresAt: Date; readonly jti: string };
}

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
