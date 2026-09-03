import type { UserData } from '@vers/contract-user';
import type { Users } from '@vers/db';
import type { Selectable } from 'kysely';

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
