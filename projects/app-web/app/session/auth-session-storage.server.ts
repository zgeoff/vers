import { createCookieSessionStorage } from 'react-router';
import invariant from 'tiny-invariant';

type SessionKey = 'accessToken' | 'expires' | 'refreshToken' | 'sessionID' | 'verifiedTime';

export type SessionData = Record<SessionKey, string>;

interface SessionFlashData {
  error: string;
}

// oxlint-disable-next-line typescript/strict-boolean-expressions -- baseline(#236)
invariant(process.env['SESSION_SECRET'], '$SESSION_SECRET is required');

export const authSessionStorage = createCookieSessionStorage<SessionData, SessionFlashData>({
  cookie: {
    // oxlint-disable-next-line typescript/no-unsafe-assignment -- baseline(#236)
    domain: import.meta.env['VITE_DOMAIN'],
    httpOnly: true,
    name: 'en_session',
    path: '/',
    sameSite: 'lax',
    secrets: [process.env['SESSION_SECRET']],

    // secure cookies only transmit over https — except on localhost, which
    // browsers treat as a secure context, so the http e2e run against the
    // production build still sends them
    secure: import.meta.env.PROD,
  },
});

// we have to do this because every time you commit the session you overwrite it
// so we store the expiration time in the cookie and reset it every time we commit
const originalCommitSession = authSessionStorage.commitSession;

Object.defineProperty(authSessionStorage, 'commitSession', {
  // oxlint-disable-next-line typescript/prefer-readonly-parameter-types -- baseline(#236)
  value: async function value(...args: Parameters<typeof originalCommitSession>) {
    const [session, options] = args;

    if (options?.expires) {
      session.set('expires', options.expires.toUTCString());
    }

    // oxlint-disable-next-line typescript/strict-boolean-expressions -- baseline(#236)
    if (options?.maxAge) {
      session.set('expires', new Date(Date.now() + options.maxAge * 1000).toUTCString());
    }

    const sessionExpires = session.get('expires');
    // oxlint-disable-next-line typescript/strict-boolean-expressions -- baseline(#236)
    const expires = sessionExpires ? new Date(sessionExpires) : undefined;

    const setCookieHeader = await originalCommitSession(session, {
      ...options,
      ...(expires !== undefined && { expires }),
    });

    return setCookieHeader;
  },
});
