import type { Context } from '../types';

interface Authed {
  user: NonNullable<Context['user']>;
}

interface MaybeAuthed {
  session: Context['session'];
  user: Context['user'];
}

export function isAuthed<T extends MaybeAuthed>(ctx: T): ctx is Authed & T {
  return Boolean(ctx.user && ctx.session);
}
