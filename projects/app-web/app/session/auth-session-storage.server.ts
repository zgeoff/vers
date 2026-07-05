import { createCookieSessionStorage } from 'react-router';
import invariant from 'tiny-invariant';

type SessionKey =
  | 'accessToken'
  | 'expires'
  | 'refreshToken'
  | 'sessionID'
  | 'verifiedTime';

export type SessionData = Record<SessionKey, string>;

interface SessionFlashData {
  error: string;
}

invariant(process.env['SESSION_SECRET'], '$SESSION_SECRET is required');

export const authSessionStorage = createCookieSessionStorage<
  SessionData,
  SessionFlashData
>({
  cookie: {
    domain: import.meta.env['VITE_DOMAIN'],
    httpOnly: true,
    name: 'en_session',
    path: '/',
    sameSite: 'lax',
    secrets: [process.env['SESSION_SECRET']],

    // only use secure cookies in prod because Safari doesn't allow setting secure cookies
    // for HTTP requests i.e. localhost which breaks our e2e
    secure: import.meta.env.PROD,
  },
});

// we have to do this because every time you commit the session you overwrite it
// so we store the expiration time in the cookie and reset it every time we commit
const originalCommitSession = authSessionStorage.commitSession;

Object.defineProperty(authSessionStorage, 'commitSession', {
  value: async function commitSession(
    ...args: Parameters<typeof originalCommitSession>
  ) {
    const [session, options] = args;

    if (options?.expires) {
      session.set('expires', options.expires.toUTCString());
    }

    if (options?.maxAge) {
      session.set(
        'expires',
        new Date(Date.now() + options.maxAge * 1000).toUTCString(),
      );
    }

    const sessionExpires = session.get('expires');
    const expires = sessionExpires ? new Date(sessionExpires) : undefined;

    const setCookieHeader = await originalCommitSession(session, {
      ...options,
      ...(expires !== undefined && { expires }),
    });

    return setCookieHeader;
  },
});
