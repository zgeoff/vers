export const VERIFY_SESSION_KEYS = {
  login2FA: { sessionID: 'login2FA#sessionID', target: 'login2FA#target' },
  loginLogout: {
    email: 'loginLogout#email',
    redirect: 'loginLogout#redirect',
    sessionID: 'loginLogout#sessionID',
    userID: 'loginLogout#userID',
  },
  onboarding: { email: 'onboarding#email' },
} as const;
