import { createId } from '@paralleldrive/cuid2';
import type { AvatarData } from '@vers/contract-avatar';
import type { DB } from '@vers/db';
import type { Kysely } from 'kysely';
import type { EmptyErrorPayload, MissingSessionPayload } from '../types';
import { toAvatarData } from './to-avatar-data';

/**
 * oRPC handler opts for the authed `createAvatar` procedure.
 */
interface CreateAvatarOpts {
  readonly context: { readonly actingUserId: null | string };
  readonly errors: {
    readonly CONFLICT: (payload: EmptyErrorPayload) => Error;
    readonly UNAUTHORIZED: (payload: MissingSessionPayload) => Error;
  };
  readonly input: { readonly class: AvatarData['class']; readonly name: string };
}

/**
 * Creates an avatar owned by the acting user; throws CONFLICT when the name is already taken.
 */
export async function createAvatar(db: Kysely<DB>, opts: CreateAvatarOpts): Promise<AvatarData> {
  if (opts.context.actingUserId === null) {
    throw opts.errors.UNAUTHORIZED({ data: { reason: 'missing-session' } });
  }

  try {
    const row = await db
      .insertInto('avatars')
      .values({
        class: opts.input.class,
        id: createId(),
        name: opts.input.name,
        userId: opts.context.actingUserId,
      })
      .returningAll()
      .executeTakeFirstOrThrow();

    return toAvatarData(row);
  } catch (error: unknown) {
    if (isUniqueViolation(error)) {
      throw opts.errors.CONFLICT({ data: {} });
    }

    throw error;
  }
}

/**
 * postgres.js surfaces a unique-constraint violation as SQLSTATE 23505.
 */
function isUniqueViolation(error: unknown): boolean {
  return typeof error === 'object' && error !== null && 'code' in error && error.code === '23505';
}
