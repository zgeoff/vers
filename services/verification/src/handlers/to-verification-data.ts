import type { VerificationData } from '@vers/contract-verification';
import type { Verifications } from '@vers/db';
import type { Selectable } from 'kysely';

export function toVerificationData(row: Readonly<Selectable<Verifications>>): VerificationData {
  return {
    id: row.id,
    target: row.target,
    type: row.type,
  };
}
