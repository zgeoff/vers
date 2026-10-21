import { z } from 'zod';
import type { VerifySessionData, VerifySessionKey } from './types';

const verifySessionDataSchema = z.object({
  'login2FA#sessionID': z.string().optional(),
  'login2FA#target': z.string().optional(),
  'loginLogout#email': z.string().optional(),
  'loginLogout#redirect': z.string().optional(),
  'loginLogout#sessionID': z.string().optional(),
  'loginLogout#userID': z.string().optional(),
  'onboarding#email': z.string().optional(),
} satisfies Record<VerifySessionKey, z.ZodType>);

export function parseVerifySessionData(value: unknown): VerifySessionData {
  const result = verifySessionDataSchema.safeParse(value);

  if (!result.success) {
    return {};
  }

  // a key set to undefined clears it, so it leaves the data rather than staying as an empty key
  return Object.fromEntries(Object.entries(result.data).filter(([, entry]) => entry !== undefined));
}
