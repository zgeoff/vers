import type { VerificationData } from '@vers/contract-verification';
import type { Verifications } from '@vers/db';
import type { Selectable } from 'kysely';

/** Maps a kysely `verifications` row onto the contract's `VerificationData` shape, stripping the TOTP secret and its configuration. */
export function toVerificationData(row: Readonly<Selectable<Verifications>>): VerificationData {
  return {
    id: row.id,
    target: row.target,
    type: row.type,
  };
}
