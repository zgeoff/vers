import type { Context, Next } from 'hono';

// oxlint-disable-next-line typescript/prefer-readonly-parameter-types -- baseline(#236)
export async function removeTrailingSlash(ctx: Context, next: Next) {
  const url = new URL(ctx.req.url);

  if (url.pathname.length > 1 && url.pathname.endsWith('/')) {
    const newPathname = url.pathname.slice(0, -1);
    const newUrl = `${newPathname}${url.search}`;

    return ctx.redirect(newUrl, 302);
  }

  // oxlint-disable-next-line typescript/no-confusing-void-expression, typescript/return-await -- baseline(#236)
  return await next();
}
