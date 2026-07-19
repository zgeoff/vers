import * as z from 'zod';

/**
 * The token pair a refresh returns; the access token is short-lived, the refresh token rotates.
 */
export const SessionTokensSchema = z.object({
  accessToken: z.string(),
  refreshToken: z.string(),
});

export type SessionTokens = z.infer<typeof SessionTokensSchema>;
