import * as z from 'zod';

export const SessionTokensSchema = z.object({
  accessToken: z.string(),
  refreshToken: z.string(),
});

export type SessionTokens = z.infer<typeof SessionTokensSchema>;
