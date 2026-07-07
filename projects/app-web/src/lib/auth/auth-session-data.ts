/** The `en_session` cookie's stored shape: the caller's live session plus its target expiry. */
export interface AuthSessionData {
  readonly accessToken?: string;
  readonly expires?: string;
  readonly refreshToken?: string;
  readonly sessionID?: string;
}
