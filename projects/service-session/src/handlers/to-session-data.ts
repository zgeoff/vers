import type { SessionData } from '@vers/contract-session';
import type { Sessions } from '@vers/db';
import type { Selectable } from 'kysely';

/** Maps a kysely `sessions` row onto the contract's `SessionData` shape, stripping token columns. */
export function toSessionData(row: Readonly<Selectable<Sessions>>): SessionData {
  return {
    createdAt: row.createdAt,
    expiresAt: row.expiresAt,
    id: row.id,
    ipAddress: row.ipAddress,
    updatedAt: row.updatedAt,
    userID: row.userId,
    verified: row.verified,
  };
}
