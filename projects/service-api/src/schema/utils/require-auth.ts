import type { AuthedContext, Context } from '~/types';
import { isAuthed } from '~/utils/is-authed';

type Resolver<TParent, TArgs, TReturn> = (
  parent: TParent,
  args: TArgs,
  ctx: Context,
) => Promise<TReturn>;

type AuthedResolver<TParent, TArgs, TReturn> = (
  parent: TParent,
  args: TArgs,
  ctx: AuthedContext,
) => Promise<TReturn>;

export function requireAuth<TParent, TArgs, TReturn>(
  resolver: AuthedResolver<TParent, TArgs, TReturn>,
): Resolver<TParent, TArgs, TReturn> {
  return async (parent, args, ctx) => {
    if (!isAuthed(ctx)) {
      throw new Error('Unauthorized');
    }

    return resolver(parent, args, ctx);
  };
}
