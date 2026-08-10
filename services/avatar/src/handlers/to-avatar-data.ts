import type { AvatarData } from '@vers/contract-avatar';
import type { Avatars } from '@vers/db';
import type { Selectable } from 'kysely';

/**
 * Maps a kysely `avatars` row (camelCase columns) onto the contract's `AvatarData` shape.
 */
export function toAvatarData(row: Readonly<Selectable<Avatars>>): AvatarData {
  return {
    createdAt: row.createdAt,
    id: row.id,
    level: row.level,
    mode: row.mode,
    name: row.name,
    seed: row.seed,
    updatedAt: row.updatedAt,
    userID: row.userId,
    xp: row.xp,
  };
}
