import { safe } from '@orpc/client';
import { clearAuthSession } from '../auth/clear-auth-session';
import { getAuthSession } from '../auth/get-auth-session';
import { updateAuthSession } from '../auth/update-auth-session';

interface ServiceFetchInit {
  readonly redirect?: RequestRedirect;
}

/**
 * Wraps a service call's underlying fetch with transparent token refresh: a `401` triggers exactly
 * one refresh-and-retry using the `en_session` cookie's refresh token. A refresh that itself fails,
 * or that can't even be attempted (no cookie session, or no ambient request at all), clears the
 * cookie if one exists and returns the original `401` unchanged — the caller's own guard redirects
 * to login on its next request.
 */
export function buildAuthenticatedFetch(): (
  request: Request,
  init: ServiceFetchInit,
) => Promise<Response> {
  return async (request, init) => {
    // the retry needs its own untouched body: cloning after `fetch` consumes `request` throws,
    // since a `Request` with a body can only be read once
    const retryable = request.clone();

    const response = await fetch(request, init);

    if (response.status !== 401) {
      return response;
    }

    return tryRefreshAndRetry(retryable, init, response).catch(() => response);
  };
}

async function tryRefreshAndRetry(
  retryable: Request,
  init: ServiceFetchInit,
  originalResponse: Response,
): Promise<Response> {
  const session = await getAuthSession();

  if (session.sessionID === undefined || session.refreshToken === undefined) {
    return originalResponse;
  }

  // a dynamic import breaks the static cycle back through `build-service-link.ts`, which is what
  // constructs `sessionClient` in the first place
  const sessionClientModule = await import('./clients/session-client');

  const [error, tokens] = await safe(
    sessionClientModule.sessionClient.refreshTokens(
      { id: session.sessionID, refreshToken: session.refreshToken },
      { context: { headers: { authorization: `Bearer ${session.sessionID}` } } },
    ),
  );

  if (error !== null) {
    await clearAuthSession();

    return originalResponse;
  }

  await updateAuthSession({ accessToken: tokens.accessToken, refreshToken: tokens.refreshToken });

  const retryHeaders = new Headers(retryable.headers);

  retryHeaders.set('authorization', `Bearer ${tokens.accessToken}`);

  return fetch(new Request(retryable, { headers: retryHeaders }), init);
}
