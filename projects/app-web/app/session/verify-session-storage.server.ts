import { createCookieSessionStorage } from 'react-router';
import invariant from 'tiny-invariant';

// we prefix these session keys with the operation they're attached to
// to mitigate issues if the user has multiple operations in progress at once
/* oxlint-disable @stylistic/lines-around-comment -- oxfmt pins the first union-member comment to the `=` line */
export type SessionKey =
  // 2FA login
  /* oxlint-enable @stylistic/lines-around-comment */
  | 'login2FA#sessionID'
  | 'login2FA#transactionID'
  | 'login2FA#transactionToken'

  // login with forced logout
  | 'loginLogout#email'
  | 'loginLogout#transactionToken'

  // disable 2FA
  | 'disable2FA#transactionID'

  // 2FA enable
  | 'enable2FA#transactionID'

  // onboarding
  | 'onboarding#email'
  | 'onboarding#transactionID'
  | 'onboarding#transactionToken'

  // change email
  | 'changeEmail#transactionID'
  | 'changeEmail#transactionToken'

  // change email confirmation
  | 'changeEmailConfirm#transactionID'

  // change password
  | 'changePassword#transactionID'
  | 'changePassword#transactionToken'

  // reset password
  | 'resetPassword#transactionID'
  | 'resetPassword#transactionToken';

export type SessionData = Record<SessionKey, string>;

interface SessionFlashData {
  error: string;
}

// oxlint-disable-next-line typescript/strict-boolean-expressions -- baseline(#236)
invariant(process.env['SESSION_SECRET'], '$SESSION_SECRET is required');

export const verifySessionStorage = createCookieSessionStorage<SessionData, SessionFlashData>({
  cookie: {
    // oxlint-disable-next-line typescript/no-unsafe-assignment -- baseline(#236)
    domain: import.meta.env['VITE_DOMAIN'],
    httpOnly: true,
    maxAge: 60 * 10,
    name: 'en_verification',
    path: '/',
    sameSite: 'lax',
    secrets: [process.env['SESSION_SECRET']],

    // secure cookies only transmit over https — except on localhost, which
    // browsers treat as a secure context, so the http e2e run against the
    // production build still sends them
    secure: import.meta.env.PROD,
  },
});
