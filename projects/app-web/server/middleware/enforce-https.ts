import type { Context, Next } from 'hono';

export async function enforceHTTPS(ctx: Context, next: Next) {
  const proto = ctx.req.header('X-Forwarded-Proto');
  const host = ctx.req.header('Host');

  if (proto === 'http') {
    const secureUrl = `https://${host}${ctx.req.url}`;

    return ctx.redirect(secureUrl, 301);
  }

  return await next();
}
