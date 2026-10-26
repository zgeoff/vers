import { expect, test } from 'bun:test';
import { VERIFY_SESSION_KEYS } from './verify-session-keys';

// a sealed verify cookie written before a deploy holds these keys, so a renamed key drops every
// sign-in, force-logout and onboarding flow that is in progress across the deploy
test('it keeps the cookie keys that an in-progress verify flow already holds', () => {
  expect(VERIFY_SESSION_KEYS).toStrictEqual({
    login2FA: { sessionID: 'login2FA#sessionID', target: 'login2FA#target' },
    loginLogout: {
      email: 'loginLogout#email',
      redirect: 'loginLogout#redirect',
      sessionID: 'loginLogout#sessionID',
      userID: 'loginLogout#userID',
    },
    onboarding: { email: 'onboarding#email' },
  });
});
