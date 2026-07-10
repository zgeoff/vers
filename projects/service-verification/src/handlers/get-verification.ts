import type { VerificationData, VerificationType } from '@vers/contract-verification';
import type { DB } from '@vers/db';
import type { Kysely } from 'kysely';
import { toVerificationData } from './to-verification-data';

/**
 * oRPC handler opts for the `getVerification` procedure.
 */
interface GetVerificationOpts {
  readonly input: { readonly target: string; readonly type: VerificationType };
}

/**
 * Looks up a verification by target and type; deletes and returns null when it has expired.
 */
export async function getVerification(
  db: Kysely<DB>,
  opts: GetVerificationOpts,
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
