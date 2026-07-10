/** The `en_session` cookie's stored shape: the caller's live session plus its target expiry. */
export interface AuthSessionData {
  readonly accessToken?: string;
  readonly expires?: string;
  readonly refreshToken?: string;
  readonly sessionID?: string;
  readonly userID?: string;
}

/**
 * Keys are prefixed with the flow they belong to so two in-flight flows sharing the one
 * `en_verification` cookie can't clobber each other's state.
 */
type VerifySessionKey =
  | 'login2FA#sessionID'
  | 'login2FA#target'
  | 'loginLogout#email'
  | 'loginLogout#sessionID'
  | 'loginLogout#userID'
  | 'onboarding#email';

/** A write with an explicit `undefined` value clears that key. */
export type VerifySessionData = Partial<Record<VerifySessionKey, string | undefined>>;
