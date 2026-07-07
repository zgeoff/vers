/**
 * Keys are prefixed with the flow they belong to so two in-flight flows sharing the one
 * `en_verification` cookie can't clobber each other's state.
 */
export type VerifySessionKey = 'login2FA#sessionID' | 'loginLogout#email' | 'loginLogout#sessionID';

export type VerifySessionData = Partial<Record<VerifySessionKey, string>>;

/** An update to the verify session: an explicit `undefined` clears that key. */
export type VerifySessionUpdate = Partial<Record<VerifySessionKey, string | undefined>>;
