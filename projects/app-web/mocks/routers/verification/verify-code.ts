import type { VerificationType } from '@vers/contract-verification';
import { verificationCollection } from '../../db/verification-collection';
import { os } from './os';

/** Verification types whose code is consumed once and the row deleted on a successful verify. */
const DELETING_TYPES: ReadonlySet<VerificationType> = new Set(['change-email', 'onboarding']);

export const verifyCode = os.verifyCode.handler((opts) => {
  const row = verificationCollection.findFirst((q) =>
    q.where({ target: opts.input.target, type: opts.input.type }),
  );

  if (row === undefined) {
    throw opts.errors.INVALID_CODE({ data: {} });
  }

  if (row.expiresAt !== null && row.expiresAt < new Date()) {
    verificationCollection.delete(row);

    throw opts.errors.CODE_EXPIRED({ data: {} });
  }

  if (row.code !== opts.input.code) {
    throw opts.errors.INVALID_CODE({ data: {} });
  }

  if (DELETING_TYPES.has(opts.input.type)) {
    verificationCollection.delete(row);
  }

  return { id: row.id, target: row.target, type: row.type };
});
