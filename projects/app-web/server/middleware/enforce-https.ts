import type { Context, Next } from 'hono';

// oxlint-disable-next-line typescript/prefer-readonly-parameter-types -- baseline(#236)
export async function enforceHTTPS(ctx: Context, next: Next) {
  const proto = ctx.req.header('X-Forwarded-Proto');
  const host = ctx.req.header('Host');

  if (proto === 'http') {
    const secureUrl = `https://${host}${ctx.req.url}`;

    return ctx.redirect(secureUrl, 301);
  }

  // oxlint-disable-next-line typescript/no-confusing-void-expression, typescript/return-await -- baseline(#236)
  return await next();
}
