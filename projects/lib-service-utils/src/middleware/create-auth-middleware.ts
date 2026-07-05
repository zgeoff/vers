import type { Context, Next } from 'hono';
import { HTTPException } from 'hono/http-exception';
import { createTokenVerifier } from '../utils/create-token-verifier';
import type { TokenVerifierConfig } from '../utils/create-token-verifier';
import { getTokenFromHeader } from '../utils/get-token-from-header';

interface AuthMiddlewareConfig {
  isAuthRequired?: boolean;
  tokenVerifierConfig: TokenVerifierConfig;
}

// this is adapted from the generic jwt middleware for hono
// ref: https://github.com/honojs/hono/blob/d091c6a180887d69715abcd84ea88a123c876305/src/middleware/jwt/index.test.ts
export function createAuthMiddleware(config: AuthMiddlewareConfig) {
  const verifyToken = createTokenVerifier({
    audience: config.tokenVerifierConfig.audience,
    issuer: config.tokenVerifierConfig.issuer,
    spkiKey: config.tokenVerifierConfig.spkiKey,
  });

  return async (ctx: Context, next: Next) => {
    const authHeader = ctx.req.raw.headers.get('Authorization');

    // if we don't explicitly require auth then we're safe to pass through
    // when no auth header is present
    if (!authHeader && !config.isAuthRequired) {
      await next();

      return;
    }

    if (!authHeader) {
      const errorDescription = 'no authorization included in request';

      throw new HTTPException(401, {
        message: errorDescription,
        res: createUnauthorizedResponse({
          ctx,
          description: errorDescription,
          error: 'invalid_request',
        }),
      });
    }

    const token = getTokenFromHeader(authHeader);

    if (!token) {
      const errorDescription = 'invalid authorization header structure';

      throw new HTTPException(401, {
        message: errorDescription,
        res: createUnauthorizedResponse({
          ctx,
          description: errorDescription,
          error: 'invalid_request',
        }),
      });
    }

    try {
      const payload = await verifyToken(token);

      ctx.set('token', token);
      ctx.set('jwtPayload', payload);
      ctx.set('userID', payload.sub);
    } catch (error: unknown) {
      throw new HTTPException(401, {
        cause: error,
        message: 'Unauthorized',
        res: createUnauthorizedResponse({
          ctx,
          description: 'token verification failure',
          error: 'invalid_token',
          statusText: 'Unauthorized',
        }),
      });
    }

    await next();
  };
}

interface ErrorParts {
  ctx: Context;
  description: string;
  error: string;
  statusText?: string;
}

function createUnauthorizedResponse(error: ErrorParts) {
  return new Response('Unauthorized', {
    headers: {
      'WWW-Authenticate': `Bearer realm="${error.ctx.req.url}",error="${error.error}",error_description="${error.description}"`,
    },
    status: 401,
    ...(error.statusText !== undefined && { statusText: error.statusText }),
  });
}
