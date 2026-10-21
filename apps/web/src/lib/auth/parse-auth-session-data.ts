import { z } from 'zod';
import type { AuthSessionData } from './types';

const authSessionDataSchema = z.object({
  accessToken: z.string().exactOptional(),
  expires: z.string().exactOptional(),
  refreshToken: z.string().exactOptional(),
  sessionID: z.string().exactOptional(),
  userID: z.string().exactOptional(),
} satisfies Record<keyof AuthSessionData, z.ZodType>);

export function parseAuthSessionData(value: unknown): AuthSessionData {
  const result = authSessionDataSchema.safeParse(value);

  return result.success ? result.data : {};
}
