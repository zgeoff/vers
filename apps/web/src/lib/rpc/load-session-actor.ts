import { isDefinedError, safe } from '@orpc/client';
import { getRequest } from '@tanstack/react-start/server';
import * as jose from 'jose';
import { getAuthSession } from '../auth/get-auth-session';
import { removeAuthSession } from '../auth/remove-auth-session';
import { updateAuthSession } from '../auth/update-auth-session';
import { sessionExistenceClient } from './clients/session-existence-client';
import { sessionRefreshClient } from './clients/session-refresh-client';

/**
 * How far ahead of the access token's real `exp` a refresh is triggered proactively.
 */
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
 * The validated identity pair a cookie-derived service call acts as: the user for the token's
 * `sub` claim, the session for its `sid` claim (the writer identity activity appends are checked
 * against).
 */
export interface SessionActor {
  readonly sessionID: string;
  readonly userID: string;
}

/**
 * Loads the acting user and session ids for a cookie-derived service call, proactively re-validating a
 * near-expired session first: services no longer see the caller's own access token, so nothing
 * else re-checks the underlying session's existence, expiry, or revocation before its identity is
 * trusted to mint an s2s token. Even a fresh access token no longer settles that on its own — this
 * closes the token's own trust window by confirming the session row still exists on every call,
 * request-scoped-memoized so the repeated calls one SSR request makes hit the session service at
 * most once per session. `null` covers no live session, a definitively rejected refresh, and a
 * session the confirmation found gone — the cookie is cleared in the latter two cases, and the
 * caller's own guard redirects to login on its next request. A session service that can't be
 * reached at all fails the call instead: an unreachable service is never grounds to trust the
 * token or to destroy the cookie.
 */
export async function loadSessionActor(): Promise<SessionActor | null> {
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
    const stillExists = await checkSessionStillExists(session.sessionID, session.userID);

    if (!stillExists) {
      await removeAuthSession();

      return null;
    }

    return { sessionID: session.sessionID, userID: session.userID };
  }

  const tokens = await resolveRefreshedTokens(session.sessionID, session.refreshToken);

  if (tokens === undefined) {
    await removeAuthSession();

    return null;
  }

  await updateAuthSession({ accessToken: tokens.accessToken, refreshToken: tokens.refreshToken });

  return { sessionID: session.sessionID, userID: session.userID };
}

function isAccessTokenStale(accessToken: string): boolean {
  try {
    const exp = jose.decodeJwt(accessToken).exp;

    return exp === undefined || exp <= Date.now() / 1000 + REFRESH_SKEW_SECONDS;
  } catch {
    return true;
  }
}

/**
 * Per-request cache of the session-existence check, keyed by the ambient request object: a `Map`
 * per request holding one in-flight/settled lookup per session id, so the several identity loads
 * one SSR request makes for the same session share a single existence round trip. Never a
 * module-level TTL cache — that would trust an evicted session for the life of the process instead
 * of just the request that read it.
 */
const sessionExistenceCache = new WeakMap<Request, Map<string, Promise<boolean>>>();

function checkSessionStillExists(sessionID: string, userID: string): Promise<boolean> {
  const request = getRequest();
  const perRequestCache = sessionExistenceCache.get(request) ?? new Map<string, Promise<boolean>>();

  sessionExistenceCache.set(request, perRequestCache);

  const cached = perRequestCache.get(sessionID);

  if (cached !== undefined) {
    return cached;
  }

  const check = readSessionStillExists(sessionID, userID);

  perRequestCache.set(sessionID, check);

  return check;
}

async function readSessionStillExists(sessionID: string, userID: string): Promise<boolean> {
  const row = await sessionExistenceClient.getSession(
    { id: sessionID },
    { context: { actingUserID: userID } },
  );

  return row !== null && row.userID === userID;
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

/**
 * Rotates the session's token pair, mapping only the contract's declared rejections (session gone,
 * expired, or token reuse) to `undefined` so the caller signs the session out. A transport failure
 * or unexpected service error stays a throw — it says nothing about the session, so it must not
 * end it.
 */
async function runRefresh(
  sessionID: string,
  refreshToken: string,
): Promise<RefreshedTokens | undefined> {
  const [error, tokens] = await safe(
    sessionRefreshClient.refreshTokens({ id: sessionID, refreshToken }),
  );

  if (error === null) {
    return tokens;
  }

  if (isDefinedError(error)) {
    return undefined;
  }

  throw error;
}
