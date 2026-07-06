import type { Context, MiddlewareHandler, Next } from 'hono';
import { getPath } from 'hono/utils/url';
import type { Logger } from 'pino';

interface ContextVariables {
  requestId: string;
}

export function createLoggerMiddleware(logger: Logger): MiddlewareHandler {
  return async function loggerMiddleware(
    // oxlint-disable-next-line typescript/prefer-readonly-parameter-types -- baseline(#236)
    ctx: Context<{ Variables: ContextVariables }>,
    next: Next,
  ) {
    const path = getPath(ctx.req.raw);
    const requestID = ctx.get('requestId');
    const shortRequestID = requestID.slice(0, 8);

    logger.info({ requestID }, `(${shortRequestID}) >>> ${ctx.req.method} ${path}`);

    await next();

    logger.info(
      {
        requestID,
        response: {
          ok: String(ctx.res.ok),
          status: ctx.res.status,
        },
      },
      `(${shortRequestID}) <<< ${ctx.res.status} ${path}`,
    );
  };
}
