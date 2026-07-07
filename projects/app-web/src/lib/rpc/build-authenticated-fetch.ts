import { safe } from '@orpc/client';
import { clearAuthSession } from '../auth/clear-auth-session';
import { getAuthSession } from '../auth/get-auth-session';
import { updateAuthSession } from '../auth/update-auth-session';
import { sessionRefreshClient } from './clients/session-refresh-client';

interface ServiceFetchInit {
  readonly redirect?: RequestRedirect;
}

interface RefreshedTokens {
  readonly accessToken: string;
  readonly refreshToken: string;
}

/**
 * Concurrent 401s for the same session share one in-flight refresh instead of each calling
 * `refreshTokens` — racing that call trips the service's refresh-token reuse detection and revokes
 * the session. Every service link this process builds (`buildAuthenticatedFetch` is called once per
 * `buildServiceLink`) shares this one module-scoped map, since a 401 from one service and a 401 from
 * another can both be racing a refresh for the same session.
 */
const inFlightRefreshes = new Map<string, Promise<RefreshedTokens | undefined>>();

/**
 * Wraps a service call's underlying fetch with transparent token refresh: a `401` triggers a
 * refresh-and-retry using the `en_session` cookie's refresh token. A refresh that itself fails, or
 * that can't even be attempted (no cookie session, or no ambient request at all), clears the cookie
 * if one exists and returns the original `401` unchanged — the caller's own guard redirects to
 * login on its next request.
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

  const tokens = await resolveRefreshedTokens(session.sessionID, session.refreshToken);

  if (tokens === undefined) {
    return originalResponse;
  }

  const retryHeaders = new Headers(retryable.headers);

  retryHeaders.set('authorization', `Bearer ${tokens.accessToken}`);

  return fetch(new Request(retryable, { headers: retryHeaders }), init);
}

/**
 * Single-flights refreshes by session ID: a 401 that arrives while another request's refresh for
 * the same session is already in progress awaits and reuses that result instead of racing it with
 * its own `refreshTokens` call.
 */
async function resolveRefreshedTokens(
  sessionID: string,
  refreshToken: string,
): Promise<RefreshedTokens | undefined> {
  const existing = inFlightRefreshes.get(sessionID);

  if (existing !== undefined) {
    return existing;
  }

  const refresh = runRefresh(sessionID, refreshToken);

  inFlightRefreshes.set(sessionID, refresh);

  try {
    return await refresh;
  } finally {
    inFlightRefreshes.delete(sessionID);
  }
}

async function runRefresh(
  sessionID: string,
  refreshToken: string,
): Promise<RefreshedTokens | undefined> {
  const [error, tokens] = await safe(
    sessionRefreshClient.refreshTokens(
      { id: sessionID, refreshToken },
      { context: { headers: { authorization: `Bearer ${sessionID}` } } },
    ),
  );

  if (error !== null) {
    await clearAuthSession();

    return undefined;
  }

  await updateAuthSession({ accessToken: tokens.accessToken, refreshToken: tokens.refreshToken });

  return tokens;
}
