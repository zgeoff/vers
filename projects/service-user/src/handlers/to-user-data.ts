import type { UserData } from '@vers/contract-user';
import type { Users } from '@vers/db';
import type { Selectable } from 'kysely';

/** Maps a kysely `users` row onto the contract's `UserData` shape, stripping credential fields. */
export function toUserData(row: Readonly<Selectable<Users>>): UserData {
  return {
    createdAt: row.createdAt,
    email: row.email,
    id: row.id,
    name: row.name,
    seed: row.seed,
    updatedAt: row.updatedAt,
    username: row.username,
  };
}
