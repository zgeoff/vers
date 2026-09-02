import type { ActivityFailureAction } from '@vers/contract-activity';
import type { DB } from '@vers/db';
import type { Kysely } from 'kysely';
import type { EmptyErrorPayload, MissingSessionPayload } from '../types';

interface UpdateFailureActionOpts {
  readonly context: { readonly actingUserID: null | string };
  readonly errors: {
    readonly NOT_FOUND: (payload: EmptyErrorPayload) => Error;
    readonly UNAUTHORIZED: (payload: MissingSessionPayload) => Error;
  };
  readonly input: { readonly avatarID: string; readonly failureAction: ActivityFailureAction };
}

interface UpdateFailureActionResult {
  readonly failureAction: ActivityFailureAction;
}

export async function updateFailureAction(
  db: Kysely<DB>,
  opts: UpdateFailureActionOpts,
): Promise<UpdateFailureActionResult> {
  if (opts.context.actingUserID === null) {
    throw opts.errors.UNAUTHORIZED({ data: { reason: 'missing-session' } });
  }

  const row = await db
    .updateTable('avatars')
    .set({ failureAction: opts.input.failureAction })
    .where('id', '=', opts.input.avatarID)
    .where('userId', '=', opts.context.actingUserID)
    .returning('failureAction')
    .executeTakeFirst();

  if (row === undefined) {
    throw opts.errors.NOT_FOUND({ data: {} });
  }

  return { failureAction: row.failureAction };
}
