import { isDefinedError, safe } from '@orpc/client';
import { getRequest } from '@tanstack/react-start/server';
import * as jose from 'jose';
import { getAuthSession } from '../auth/get-auth-session';
import { removeAuthSession } from '../auth/remove-auth-session';
import { updateAuthSession } from '../auth/update-auth-session';
import { sessionExistenceClient } from './clients/session-existence-client';
import { sessionRefreshClient } from './clients/session-refresh-client';

const REFRESH_SKEW_SECONDS = 30;

interface RefreshedTokens {
  readonly accessToken: string;
  readonly refreshToken: string;
}

type RefreshFailure = 'expired' | 'superseded';

// concurrent calls for one session share a single refresh: racing the refresh call trips the
// service's refresh-token reuse detection, which revokes the session
const inFlightRefreshes = new Map<string, Promise<RefreshFailure | RefreshedTokens>>();

export type SessionActorOutcome =
  | { readonly kind: 'actor'; readonly sessionID: string; readonly userID: string }
  | { readonly kind: 'signed-out' }
  | { readonly kind: 'superseded' };

export async function loadSessionActor(): Promise<SessionActorOutcome> {
  const session = await getAuthSession();

  if (
    session.userID === undefined ||
    session.sessionID === undefined ||
    session.accessToken === undefined ||
    session.refreshToken === undefined
  ) {
    return { kind: 'signed-out' };
  }

  if (!isAccessTokenStale(session.accessToken)) {
    const stillExists = await checkSessionStillExists(session.sessionID, session.userID);

    // the row is gone while the token this call carries is still valid: only a deletion does that,
    // never an expiry, which leaves the row in place for the refresh path below to judge
    if (!stillExists) {
      await removeAuthSession();

      return { kind: 'superseded' };
    }

    return { kind: 'actor', sessionID: session.sessionID, userID: session.userID };
  }

  const refreshed = await resolveRefreshedTokens(session.sessionID, session.refreshToken);

  if (refreshed === 'expired' || refreshed === 'superseded') {
    await removeAuthSession();

    return refreshed === 'expired' ? { kind: 'signed-out' } : { kind: 'superseded' };
  }

  await updateAuthSession({
    accessToken: refreshed.accessToken,
    refreshToken: refreshed.refreshToken,
  });

  return { kind: 'actor', sessionID: session.sessionID, userID: session.userID };
}

function isAccessTokenStale(accessToken: string): boolean {
  try {
    const exp = jose.decodeJwt(accessToken).exp;

    return exp === undefined || exp <= Date.now() / 1000 + REFRESH_SKEW_SECONDS;
  } catch {
    return true;
  }
}

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
): Promise<RefreshFailure | RefreshedTokens> {
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
): Promise<RefreshFailure | RefreshedTokens> {
  const [error, tokens] = await safe(
    sessionRefreshClient.refreshTokens({ id: sessionID, refreshToken }),
  );

  if (error === null) {
    return tokens;
  }

  if (isDefinedError(error)) {
    return error.code === 'SESSION_EXPIRED' ? 'expired' : 'superseded';
  }

  throw error;
}
