import type { VerificationData, VerificationType } from '@vers/contract-verification';
import type { DB } from '@vers/db';
import type { Kysely } from 'kysely';
import { toVerificationData } from './to-verification-data';

interface ReadVerificationOpts {
  readonly input: { readonly target: string; readonly type: VerificationType };
}

export async function readVerification(
  db: Kysely<DB>,
  opts: ReadVerificationOpts,
): Promise<VerificationData | null> {
  const row = await db
    .selectFrom('verifications')
    .selectAll()
    .where('type', '=', opts.input.type)
    .where('target', '=', opts.input.target)
    .executeTakeFirst();

  if (row === undefined) {
    return null;
  }

  if (row.expiresAt !== null && row.expiresAt < new Date()) {
    await db.deleteFrom('verifications').where('id', '=', row.id).execute();

    return null;
  }

  return toVerificationData(row);
}
