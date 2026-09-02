export interface AuthSessionData {
  readonly accessToken?: string;
  readonly expires?: string;
  readonly refreshToken?: string;
  readonly sessionID?: string;
  readonly userID?: string;
}

type VerifySessionKey =
  | 'login2FA#sessionID'
  | 'login2FA#target'
  | 'loginLogout#email'
  | 'loginLogout#redirect'
  | 'loginLogout#sessionID'
  | 'loginLogout#userID'
  | 'onboarding#email';

export type VerifySessionData = Partial<Record<VerifySessionKey, string | undefined>>;
