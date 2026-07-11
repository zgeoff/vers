import type { DB } from '@vers/db';
import type { Kysely } from 'kysely';
import type { MissingSessionPayload } from '../types';

/**
 * oRPC handler opts for the authed `deleteSession` procedure.
 */
interface RemoveSessionOpts {
  readonly context: { readonly actingUserId: null | string };
  readonly errors: {
    readonly UNAUTHORIZED: (payload: MissingSessionPayload) => Error;
  };
  readonly input: { readonly id: string };
}

/**
 * Removes a session owned by the acting user. A foreign or already-missing id is a silent
 * no-op (#147) — the contract declares no NOT_FOUND, so ownership can't be probed by inspecting
 * the response.
 */
export async function removeSession(
  db: Kysely<DB>,
  opts: RemoveSessionOpts,
): Promise<Record<never, never>> {
  if (opts.context.actingUserId === null) {
    throw opts.errors.UNAUTHORIZED({ data: { reason: 'missing-session' } });
  }

  await db
    .deleteFrom('sessions')
    .where('id', '=', opts.input.id)
    .where('userId', '=', opts.context.actingUserId)
    .execute();

  return {};
}
