import type { AvatarData } from '@vers/contract-avatar';
import type { DB } from '@vers/db';
import type { Kysely } from 'kysely';
import type { MissingSessionPayload } from '../types';
import { toAvatarData } from './to-avatar-data';

interface ReadAvatarOpts {
  readonly context: { readonly actingUserID: null | string };
  readonly errors: {
    readonly UNAUTHORIZED: (payload: MissingSessionPayload) => Error;
  };
  readonly input: { readonly id: string };
}

export async function readAvatar(db: Kysely<DB>, opts: ReadAvatarOpts): Promise<AvatarData | null> {
  if (opts.context.actingUserID === null) {
    throw opts.errors.UNAUTHORIZED({ data: { reason: 'missing-session' } });
  }

  const row = await db
    .selectFrom('avatars')
    .selectAll()
    .where('id', '=', opts.input.id)
    .where('userId', '=', opts.context.actingUserID)
    .executeTakeFirst();

  return row === undefined ? null : toAvatarData(row);
}
