import type { Context, Next } from 'hono';
import { HTTPException } from 'hono/http-exception';
import { createTokenVerifier } from '../utils/create-token-verifier';
import type { RelevantJWTPayload, TokenVerifierConfig } from '../utils/create-token-verifier';
import { getTokenFromHeader } from '../utils/get-token-from-header';

interface AuthMiddlewareConfig {
  readonly isAuthRequired?: boolean;
  readonly tokenVerifierConfig: TokenVerifierConfig;
}

/** Context variables `createAuthMiddleware` sets once a token verifies. */
export interface AuthContextVariables {
  jwtPayload: RelevantJWTPayload;
  token: string;
  userID: string;
}

// this is adapted from the generic jwt middleware for hono
// ref: https://github.com/honojs/hono/blob/d091c6a180887d69715abcd84ea88a123c876305/src/middleware/jwt/index.test.ts
export function createAuthMiddleware(config: AuthMiddlewareConfig) {
  const verifyToken = createTokenVerifier({
    audience: config.tokenVerifierConfig.audience,
    issuer: config.tokenVerifierConfig.issuer,
    spkiKey: config.tokenVerifierConfig.spkiKey,
  });

  return async (ctx: Context<{ Variables: AuthContextVariables }>, next: Next) => {
    const authHeader = ctx.req.raw.headers.get('Authorization');

    // if we don't explicitly require auth then we're safe to pass through
    // when no auth header is present
    if (authHeader === null && config.isAuthRequired !== true) {
      await next();

      return;
    }

    if (authHeader === null) {
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

    if (token === null) {
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
  readonly ctx: Context;
  readonly description: string;
  readonly error: string;
  readonly statusText?: string;
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
