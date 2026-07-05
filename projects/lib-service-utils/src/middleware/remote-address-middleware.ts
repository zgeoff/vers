import type { HttpBindings } from '@hono/node-server';
import type { Context, Next } from 'hono';

interface Env {
  Bindings: {
    server?: HttpBindings;
  };
  Variables: {
    ipAddress: string;
  };
}

/**
 * Yoinks the client IP address from the request headers or the incoming socket
 * info and stores it in the context.
 *
 * There's an edge case where for god know's why the initial request to our
 * react router dev server isn't setting the socket in our hono context and we
 * can't manually set a valid request header, so we need to provide a fallback
 * case of an empty string. Otherwise we should ALWAYS have an IP address set in
 * development and production environments.
 */
// oxlint-disable-next-line typescript/prefer-readonly-parameter-types -- baseline(#236)
export async function remoteAddressMiddleware(ctx: Context<Env>, next: Next) {
  const ipAddress =
    ctx.req.header('fly-client-ip') ??
    ctx.req.header('x-forwarded-for')?.split(',')[0] ??
    ctx.env.server?.incoming.socket.remoteAddress ??
    '';

  ctx.set('ipAddress', ipAddress);

  await next();
}
