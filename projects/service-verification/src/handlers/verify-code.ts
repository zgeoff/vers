import { verifyTOTP } from '@epic-web/totp';
import type { VerificationData, VerificationType } from '@vers/contract-verification';
import type { DB } from '@vers/db';
import type { Kysely } from 'kysely';
import type { EmptyErrorPayload } from '../types';
import { toVerificationData } from './to-verification-data';

/** Verification types whose code is consumed once and the row deleted on a successful verify. */
const DELETING_TYPES: ReadonlySet<VerificationType> = new Set(['change-email', 'onboarding']);

/** oRPC handler opts for the `verifyCode` procedure. */
interface VerifyCodeOpts {
  readonly errors: {
    readonly CODE_ALREADY_USED: (payload: EmptyErrorPayload) => Error;
    readonly CODE_EXPIRED: (payload: EmptyErrorPayload) => Error;
    readonly INVALID_CODE: (payload: EmptyErrorPayload) => Error;
  };
  readonly input: {
    readonly code: string;
    readonly target: string;
    readonly type: VerificationType;
  };
}

/**
 * Verifies a TOTP code against its target and type, then guards against replay: deleting types
 * (`change-email`/`onboarding`) consume the row on success, so a concurrent second verify finds no
 * row to delete; non-deleting types (`2fa`/`2fa-setup`) record the verified code and timestamp in a
 * single conditional UPDATE that a concurrent replay's row lock forces to re-evaluate against the
 * committed value — no explicit transaction required.
 */
export async function verifyCode(db: Kysely<DB>, opts: VerifyCodeOpts): Promise<VerificationData> {
  const { code, target, type } = opts.input;

  const row = await db
    .selectFrom('verifications')
    .selectAll()
    .where('type', '=', type)
    .where('target', '=', target)
    .executeTakeFirst();

  if (row === undefined) {
    throw opts.errors.INVALID_CODE({ data: {} });
  }

  if (row.expiresAt !== null && row.expiresAt < new Date()) {
    await db.deleteFrom('verifications').where('id', '=', row.id).execute();

    throw opts.errors.CODE_EXPIRED({ data: {} });
  }

  const result = await verifyTOTP({
    algorithm: row.algorithm,
    charSet: row.charSet,
    digits: row.digits,
    otp: code,
    period: row.period,
    secret: row.secret,
  });

  if (result === null) {
    throw opts.errors.INVALID_CODE({ data: {} });
  }

  if (DELETING_TYPES.has(type)) {
    const deleteResult = await db
      .deleteFrom('verifications')
      .where('id', '=', row.id)
      .executeTakeFirst();

    if (deleteResult.numDeletedRows === 0n) {
      throw opts.errors.CODE_ALREADY_USED({ data: {} });
    }
  } else {
    const replayWindow = new Date(Date.now() - row.period * 2 * 1000);

    const updateResult = await db
      .updateTable('verifications')
      .set({ lastVerifiedAt: new Date(), lastVerifiedCode: code })
      .where('id', '=', row.id)
      .where((eb) =>
        eb.or([
          eb('lastVerifiedCode', 'is', null),
          eb('lastVerifiedAt', 'is', null),
          eb('lastVerifiedCode', '!=', code),
          eb('lastVerifiedAt', '<=', replayWindow),
        ]),
      )
      .executeTakeFirst();

    if (updateResult.numUpdatedRows === 0n) {
      throw opts.errors.CODE_ALREADY_USED({ data: {} });
    }
  }

  return toVerificationData(row);
}
