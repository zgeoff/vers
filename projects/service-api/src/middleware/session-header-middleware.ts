import type { Context, Next } from 'hono';

// oxlint-disable-next-line typescript/prefer-readonly-parameter-types -- baseline(#236)
export async function sessionHeaderMiddleware(ctx: Context, next: Next) {
  const sessionID = ctx.req.header('x-session-id');

  // oxlint-disable-next-line typescript/strict-boolean-expressions -- baseline(#236)
  if (sessionID) {
    ctx.set('sessionID', sessionID);
  }

  await next();
}
