import type { AuthedContext } from '../../types';
import { builder } from '../builder';
import { User } from '../types/user';
import { requireAuth } from '../utils/require-auth';

type Args = Record<PropertyKey, never>;

export function getCurrentUser(
  _: object,
  // oxlint-disable-next-line typescript/prefer-readonly-parameter-types -- baseline(#236)
  __: Args,
  // oxlint-disable-next-line typescript/prefer-readonly-parameter-types -- baseline(#236)
  ctx: AuthedContext,
): Promise<typeof User.$inferType> {
  // we can return the user from the context directly as it was fetched when we instantiated our context
  return Promise.resolve(ctx.user);
}

export const resolve = requireAuth(getCurrentUser);

builder.queryField('getCurrentUser', (t) =>
  t.field({
    directives: {
      rateLimit: {
        duration: 60,
        limit: 20,
      },
    },
    resolve,
    type: User,
  }),
);
