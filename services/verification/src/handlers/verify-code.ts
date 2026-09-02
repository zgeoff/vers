import { verifyTOTP } from '@epic-web/totp';
import type { VerificationData, VerificationType } from '@vers/contract-verification';
import type { DB } from '@vers/db';
import type { Kysely } from 'kysely';
import type { EmptyErrorPayload } from '../types';
import { toVerificationData } from './to-verification-data';

const DELETING_TYPES: ReadonlySet<VerificationType> = new Set(['change-email', 'onboarding']);

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

export async function verifyCode(db: Kysely<DB>, opts: VerifyCodeOpts): Promise<VerificationData> {
  const row = await db
    .selectFrom('verifications')
    .selectAll()
    .where('type', '=', opts.input.type)
    .where('target', '=', opts.input.target)
    .orderBy('createdAt', 'desc')
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
    otp: opts.input.code,
    period: row.period,
    secret: row.secret,
  });

  if (result === null) {
    throw opts.errors.INVALID_CODE({ data: {} });
  }

  if (DELETING_TYPES.has(opts.input.type)) {
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
      .set({ lastVerifiedAt: new Date(), lastVerifiedCode: opts.input.code })
      .where('id', '=', row.id)
      .where((eb) =>
        eb.or([
          eb('lastVerifiedCode', 'is', null),
          eb('lastVerifiedAt', 'is', null),
          eb('lastVerifiedCode', '!=', opts.input.code),
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
