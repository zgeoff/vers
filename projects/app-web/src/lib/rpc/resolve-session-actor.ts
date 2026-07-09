import { safe } from '@orpc/client';
import * as jose from 'jose';
import { clearAuthSession } from '../auth/clear-auth-session';
import { getAuthSession } from '../auth/get-auth-session';
import { updateAuthSession } from '../auth/update-auth-session';
import { sessionRefreshClient } from './clients/session-refresh-client';

/** How far ahead of the access token's real `exp` a refresh is triggered proactively. */
const REFRESH_SKEW_SECONDS = 30;

interface RefreshedTokens {
  readonly accessToken: string;
  readonly refreshToken: string;
}

/**
 * Concurrent calls for the same session share one in-flight refresh instead of each calling
 * `refreshTokens` — racing that call trips the service's refresh-token reuse detection and revokes
 * the session.
 */
const inFlightRefreshes = new Map<string, Promise<RefreshedTokens | undefined>>();

/**
 * Resolves the acting user id for a cookie-derived service call, proactively re-validating a
 * near-expired session first: services no longer see the caller's own access token, so nothing
 * else re-checks the underlying session's existence, expiry, or revocation before its identity is
 * trusted to mint an s2s token. `null` covers both no live session and one that failed
 * re-validation — the cookie is cleared in the latter case, and the caller's own guard redirects to
 * login on its next request.
 */
export async function resolveSessionActor(): Promise<string | null> {
  const session = await getAuthSession();

  if (
    session.userID === undefined ||
    session.sessionID === undefined ||
    session.accessToken === undefined ||
    session.refreshToken === undefined
  ) {
    return null;
  }

  if (!isAccessTokenStale(session.accessToken)) {
    return session.userID;
  }

  const tokens = await resolveRefreshedTokens(session.sessionID, session.refreshToken);

  if (tokens === undefined) {
    await clearAuthSession();

    return null;
  }

  await updateAuthSession({ accessToken: tokens.accessToken, refreshToken: tokens.refreshToken });

  return session.userID;
}

function isAccessTokenStale(accessToken: string): boolean {
  try {
    const exp = jose.decodeJwt(accessToken).exp;

    return exp === undefined || exp <= Date.now() / 1000 + REFRESH_SKEW_SECONDS;
  } catch {
    return true;
  }
}

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
    sessionRefreshClient.refreshTokens({ id: sessionID, refreshToken }),
  );

  return error === null ? tokens : undefined;
}
