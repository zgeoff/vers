import { z } from 'zod';
import type { VerifySessionData, VerifySessionKey } from './types';
import { VERIFY_SESSION_KEYS } from './verify-session-keys';

const verifySessionDataSchema = z.object({
  [VERIFY_SESSION_KEYS.login2FA.sessionID]: z.string().optional(),
  [VERIFY_SESSION_KEYS.login2FA.target]: z.string().optional(),
  [VERIFY_SESSION_KEYS.loginLogout.email]: z.string().optional(),
  [VERIFY_SESSION_KEYS.loginLogout.redirect]: z.string().optional(),
  [VERIFY_SESSION_KEYS.loginLogout.sessionID]: z.string().optional(),
  [VERIFY_SESSION_KEYS.loginLogout.userID]: z.string().optional(),
  [VERIFY_SESSION_KEYS.onboarding.email]: z.string().optional(),
} satisfies Record<VerifySessionKey, z.ZodType>);

export function parseVerifySessionData(value: unknown): VerifySessionData {
  const result = verifySessionDataSchema.safeParse(value);

  if (!result.success) {
    return {};
  }

  // a key set to undefined clears it, so it leaves the data rather than staying as an empty key
  return Object.fromEntries(Object.entries(result.data).filter(([, entry]) => entry !== undefined));
}
