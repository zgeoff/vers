import type { VERIFY_SESSION_KEYS } from './verify-session-keys';

export interface AuthSessionData {
  readonly accessToken?: string;
  readonly expires?: string;
  readonly refreshToken?: string;
  readonly sessionID?: string;
  readonly userID?: string;
}

type VerifySessionKeyMap = typeof VERIFY_SESSION_KEYS;

export type VerifySessionKey = {
  [Flow in keyof VerifySessionKeyMap]: VerifySessionKeyMap[Flow][keyof VerifySessionKeyMap[Flow]];
}[keyof VerifySessionKeyMap];

export type VerifySessionData = Partial<Record<VerifySessionKey, string | undefined>>;
